#include <iostream>
#include <string>
#include <sstream>
#include <vector>
#include <thread>
#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <semaphore>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
#endif

#include "json_helper.hpp"
#include "evaluator.hpp"

const int DEFAULT_PORT = 8082;
constexpr size_t MAX_HEADER_BYTES = 16 * 1024;
constexpr long long MAX_BODY_BYTES = 512 * 1024;
constexpr size_t MAX_TEST_CASES = 50;
constexpr int MIN_TIME_LIMIT_MS = 100;
constexpr int MAX_TIME_LIMIT_MS = 10000;
constexpr DWORD SOCKET_TIMEOUT_MS = 15000;

// At most this many submissions compile/run at once; others wait for a slot.
static std::counting_semaphore<4> evalSlots(4);

struct SlotGuard {
    SlotGuard() { evalSlots.acquire(); }
    ~SlotGuard() { evalSlots.release(); }
};

static std::string toLowerCopy(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) { return (char)std::tolower(c); });
    return s;
}

/** Returns the value of a header (case-insensitive name) or an empty string. */
static std::string getHeader(const std::string& headers, const std::string& name) {
    std::string lower = toLowerCopy(headers);
    std::string key = "\r\n" + toLowerCopy(name) + ":";
    size_t pos = lower.find(key);
    if (pos == std::string::npos) return "";
    size_t valStart = pos + key.size();
    size_t valEnd = headers.find("\r\n", valStart);
    std::string value = headers.substr(valStart, valEnd == std::string::npos ? std::string::npos : valEnd - valStart);
    value.erase(0, value.find_first_not_of(" \t"));
    value.erase(value.find_last_not_of(" \t") + 1);
    return value;
}

/** Constant-time comparison so the token can't be guessed byte-by-byte from timing. */
static bool secureEquals(const std::string& a, const std::string& b) {
    if (a.size() != b.size()) return false;
    unsigned char diff = 0;
    for (size_t i = 0; i < a.size(); ++i) diff |= (unsigned char)(a[i] ^ b[i]);
    return diff == 0;
}

void sendResponse(SOCKET clientSocket, int statusCode, const std::string& statusText,
                  const std::string& contentType, const std::string& body) {
    // No CORS headers: only the API gateway (server-to-server) may call this service.
    std::ostringstream response;
    response << "HTTP/1.1 " << statusCode << " " << statusText << "\r\n"
             << "Content-Type: " << contentType << "\r\n"
             << "Content-Length: " << body.length() << "\r\n"
             << "X-Content-Type-Options: nosniff\r\n"
             << "Connection: close\r\n\r\n"
             << body;

    std::string respStr = response.str();
    send(clientSocket, respStr.c_str(), (int)respStr.length(), 0);
}

static void sendError(SOCKET s, int code, const std::string& text, const std::string& message) {
    sendResponse(s, code, text, "application/json", "{\"error\":\"" + SimpleJson::escapeString(message) + "\"}");
}

void handleClient(SOCKET clientSocket) {
    try {
        setsockopt(clientSocket, SOL_SOCKET, SO_RCVTIMEO, (const char*)&SOCKET_TIMEOUT_MS, sizeof(SOCKET_TIMEOUT_MS));
        setsockopt(clientSocket, SOL_SOCKET, SO_SNDTIMEO, (const char*)&SOCKET_TIMEOUT_MS, sizeof(SOCKET_TIMEOUT_MS));

        std::string requestData;
        char buffer[4096];
        int bytesRead = 0;

        // Read headers (bounded)
        size_t headerEnd = std::string::npos;
        while ((bytesRead = recv(clientSocket, buffer, sizeof(buffer), 0)) > 0) {
            requestData.append(buffer, bytesRead);
            headerEnd = requestData.find("\r\n\r\n");
            if (headerEnd != std::string::npos) break;
            if (requestData.size() > MAX_HEADER_BYTES) {
                sendError(clientSocket, 431, "Request Header Fields Too Large", "Headers too large");
                closesocket(clientSocket);
                return;
            }
        }

        if (requestData.empty() || headerEnd == std::string::npos) {
            closesocket(clientSocket);
            return;
        }

        std::string headers = requestData.substr(0, headerEnd);

        // Parse method and path
        std::istringstream reqStream(headers);
        std::string method, path, protocol;
        reqStream >> method >> path >> protocol;

        if (path == "/health" && method == "GET") {
            std::string healthJson = "{\"status\":\"UP\",\"service\":\"C++ Code Evaluation Engine\",\"supportedLanguages\":[\"python\",\"javascript\",\"cpp\",\"c\"]}";
            sendResponse(clientSocket, 200, "OK", "application/json", healthJson);
            closesocket(clientSocket);
            return;
        }

        if (path == "/evaluate" && method == "POST") {
            // Require a JSON content type: browsers cannot send it cross-origin without a
            // CORS preflight (which this service never approves), blocking drive-by requests.
            if (toLowerCopy(getHeader(headers, "Content-Type")).rfind("application/json", 0) != 0) {
                sendError(clientSocket, 415, "Unsupported Media Type", "Content-Type must be application/json");
                closesocket(clientSocket);
                return;
            }

            // Optional shared secret: when EVALUATOR_TOKEN is set, only callers presenting it are served.
            const char* token = std::getenv("EVALUATOR_TOKEN");
            if (token && *token && !secureEquals(getHeader(headers, "X-Evaluator-Token"), token)) {
                sendError(clientSocket, 403, "Forbidden", "Forbidden");
                closesocket(clientSocket);
                return;
            }

            long long contentLength = -1;
            std::string clStr = getHeader(headers, "Content-Length");
            if (!clStr.empty()) {
                try { contentLength = std::stoll(clStr); } catch (...) { contentLength = -1; }
            }
            if (contentLength < 0 || contentLength > MAX_BODY_BYTES) {
                sendError(clientSocket, 413, "Payload Too Large", "Invalid or too large Content-Length");
                closesocket(clientSocket);
                return;
            }

            std::string body = requestData.substr(headerEnd + 4);
            while ((long long)body.length() < contentLength) {
                bytesRead = recv(clientSocket, buffer, sizeof(buffer), 0);
                if (bytesRead <= 0) break;
                body.append(buffer, bytesRead);
            }
            if ((long long)body.length() < contentLength) {
                closesocket(clientSocket); // client stalled or disconnected
                return;
            }
            body.resize((size_t)contentLength);

            std::string language = SimpleJson::extractString(body, "language");
            if (language.empty()) language = "python";
            std::string code = SimpleJson::extractString(body, "code");
            int timeLimitMs = std::clamp(SimpleJson::extractInt(body, "timeLimitMs", 3000), MIN_TIME_LIMIT_MS, MAX_TIME_LIMIT_MS);
            auto testCases = SimpleJson::extractTestCases(body);

            if (testCases.size() > MAX_TEST_CASES) {
                sendError(clientSocket, 400, "Bad Request", "Too many test cases");
                closesocket(clientSocket);
                return;
            }

            ExecutionReport report;
            {
                SlotGuard slot;
                report = CodeEvaluator::evaluate(language, code, testCases, timeLimitMs);
            }
            sendResponse(clientSocket, 200, "OK", "application/json", report.toJson());
            closesocket(clientSocket);
            return;
        }

        sendError(clientSocket, 404, "Not Found", "Route not found");
        closesocket(clientSocket);
    } catch (const std::exception& e) {
        // A detached thread must never let an exception escape (that would terminate the service)
        std::cerr << "Request handling failed: " << e.what() << std::endl;
        sendError(clientSocket, 500, "Internal Server Error", "Evaluation failed");
        closesocket(clientSocket);
    } catch (...) {
        sendError(clientSocket, 500, "Internal Server Error", "Evaluation failed");
        closesocket(clientSocket);
    }
}

int main(int argc, char* argv[]) {
    int port = DEFAULT_PORT;
    if (const char* envPort = std::getenv("PORT")) {
        try { port = std::stoi(envPort); } catch (...) {}
    }
    if (argc > 1) {
        try { port = std::stoi(argv[1]); } catch (...) {}
    }

    // Loopback only by default. Set EVALUATOR_BIND=0.0.0.0 only on a private network
    // (e.g. inside docker-compose), never on a machine reachable from untrusted hosts.
    const char* bindEnv = std::getenv("EVALUATOR_BIND");
    std::string bindAddr = (bindEnv && *bindEnv) ? bindEnv : "127.0.0.1";

    WSADATA wsaData;
    int iResult = WSAStartup(MAKEWORD(2, 2), &wsaData);
    if (iResult != 0) {
        std::cerr << "WSAStartup failed: " << iResult << std::endl;
        return 1;
    }

    SOCKET listenSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (listenSocket == INVALID_SOCKET) {
        std::cerr << "socket failed with error: " << WSAGetLastError() << std::endl;
        WSACleanup();
        return 1;
    }

    // Exclusive use: another process can't bind the same port and intercept requests
    BOOL opt = TRUE;
    setsockopt(listenSocket, SOL_SOCKET, SO_EXCLUSIVEADDRUSE, (char*)&opt, sizeof(opt));

    sockaddr_in service;
    ZeroMemory(&service, sizeof(service));
    service.sin_family = AF_INET;
    service.sin_port = htons(port);
    if (inet_pton(AF_INET, bindAddr.c_str(), &service.sin_addr) != 1) {
        std::cerr << "Invalid EVALUATOR_BIND address: " << bindAddr << std::endl;
        closesocket(listenSocket);
        WSACleanup();
        return 1;
    }

    if (bind(listenSocket, (SOCKADDR*)&service, sizeof(service)) == SOCKET_ERROR) {
        std::cerr << "bind failed with error: " << WSAGetLastError() << std::endl;
        closesocket(listenSocket);
        WSACleanup();
        return 1;
    }

    if (listen(listenSocket, SOMAXCONN) == SOCKET_ERROR) {
        std::cerr << "listen failed with error: " << WSAGetLastError() << std::endl;
        closesocket(listenSocket);
        WSACleanup();
        return 1;
    }

    const char* token = std::getenv("EVALUATOR_TOKEN");
    std::cout << "=================================================" << std::endl;
    std::cout << "  C++ Code Evaluation Engine on " << bindAddr << ":" << port << std::endl;
    std::cout << "  Process limits: Job Object (time, memory, process count)" << std::endl;
    std::cout << "  Caller auth:    " << ((token && *token) ? "EVALUATOR_TOKEN required" : "none (loopback only recommended)") << std::endl;
    std::cout << "  NOTE: user code is NOT fully sandboxed; run this service under a" << std::endl;
    std::cout << "        dedicated low-privilege account (see README)." << std::endl;
    std::cout << "  Supported: Python, JavaScript, C++, C" << std::endl;
    std::cout << "=================================================" << std::endl;

    while (true) {
        SOCKET clientSocket = accept(listenSocket, NULL, NULL);
        if (clientSocket == INVALID_SOCKET) {
            continue;
        }
        std::thread(handleClient, clientSocket).detach();
    }

    closesocket(listenSocket);
    WSACleanup();
    return 0;
}
