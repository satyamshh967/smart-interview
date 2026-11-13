#pragma once

#include <string>
#include <vector>
#include <chrono>
#include <fstream>
#include <filesystem>
#include <algorithm>
#include <iostream>
#include <sstream>
#include <random>
#include <thread>
#include <mutex>
#include <cstdint>

#ifdef _WIN32
#include <windows.h>
#include <psapi.h>
#else
#include <unistd.h>
#include <sys/wait.h>
#include <sys/resource.h>
#endif

#include "json_helper.hpp"

namespace fs = std::filesystem;

struct TestCaseOutput {
    std::string id;
    bool passed = false;
    std::string input;
    std::string expectedOutput;
    std::string actualOutput;
    long long executionTimeMs = 0;
    long long memoryKb = 0;
    std::string error;
    bool isHidden = false;

    std::string toJson() const {
        std::ostringstream ss;
        ss << "{"
           << "\"id\":\"" << SimpleJson::escapeString(id) << "\","
           << "\"passed\":" << (passed ? "true" : "false") << ","
           << "\"input\":\"" << SimpleJson::escapeString(input) << "\","
           << "\"expectedOutput\":\"" << SimpleJson::escapeString(isHidden ? "[Hidden Test Case]" : expectedOutput) << "\","
           << "\"actualOutput\":\"" << SimpleJson::escapeString(isHidden && !passed ? "[Output Hidden]" : actualOutput) << "\","
           << "\"executionTimeMs\":" << executionTimeMs << ","
           << "\"memoryKb\":" << memoryKb << ","
           << "\"error\":\"" << SimpleJson::escapeString(error) << "\","
           << "\"isHidden\":" << (isHidden ? "true" : "false")
           << "}";
        return ss.str();
    }
};

struct ExecutionReport {
    std::string status = "ACCEPTED"; // ACCEPTED, WRONG_ANSWER, TIME_LIMIT_EXCEEDED, COMPILATION_ERROR, RUNTIME_ERROR
    int totalTestCases = 0;
    int passedTestCases = 0;
    long long totalExecutionTimeMs = 0;
    long long peakMemoryKb = 0;
    std::string compilationError;
    std::vector<TestCaseOutput> details;

    std::string toJson() const {
        std::ostringstream ss;
        ss << "{"
           << "\"status\":\"" << status << "\","
           << "\"totalTestCases\":" << totalTestCases << ","
           << "\"passedTestCases\":" << passedTestCases << ","
           << "\"totalExecutionTimeMs\":" << totalExecutionTimeMs << ","
           << "\"peakMemoryKb\":" << peakMemoryKb << ",";
        if (!compilationError.empty()) {
            ss << "\"compilationError\":\"" << SimpleJson::escapeString(compilationError) << "\",";
        }
        ss << "\"details\":[";
        for (size_t i = 0; i < details.size(); ++i) {
            if (i > 0) ss << ",";
            ss << details[i].toJson();
        }
        ss << "]}";
        return ss.str();
    }
};

class CodeEvaluator {
public:
    static ExecutionReport evaluate(const std::string& language,
                                    const std::string& code,
                                    const std::vector<SimpleJson::ParsedTestCase>& testCases,
                                    int timeLimitMs = 3000) {
        ExecutionReport report;
        report.totalTestCases = (int)testCases.size();

        fs::path tempDir;
        if (!createRunDirectory(tempDir)) {
            report.status = "RUNTIME_ERROR";
            report.compilationError = "Evaluator could not create an isolated working directory";
            return report;
        }

        std::string lang = toLower(language);
        std::string execCommand;

        // Pre-compilation / Setup
        if (lang == "python" || lang == "py") {
            fs::path srcFile = tempDir / "solution.py";
            std::ofstream out(srcFile);
            out << code;
            out.close();
            execCommand = "python \"" + srcFile.string() + "\"";
        } else if (lang == "javascript" || lang == "js" || lang == "node") {
            fs::path srcFile = tempDir / "solution.js";
            std::ofstream out(srcFile);
            out << code;
            out.close();
            execCommand = "node \"" + srcFile.string() + "\"";
        } else if (lang == "cpp" || lang == "c++") {
            fs::path srcFile = tempDir / "solution.cpp";
            fs::path exeFile = tempDir / "solution.exe";
            std::ofstream out(srcFile);
            out << code;
            out.close();

            std::string compCmd = "g++ -O2 \"" + srcFile.string() + "\" -o \"" + exeFile.string() + "\"";
            std::string compErr;
            bool ok = runCompiler(compCmd, tempDir.string(), compErr);
            if (!ok || !fs::exists(exeFile)) {
                report.status = "COMPILATION_ERROR";
                report.compilationError = compErr.empty() ? "Compilation failed" : compErr;
                cleanup(tempDir);
                return report;
            }
            execCommand = "\"" + exeFile.string() + "\"";
        } else if (lang == "c") {
            fs::path srcFile = tempDir / "solution.c";
            fs::path exeFile = tempDir / "solution.exe";
            std::ofstream out(srcFile);
            out << code;
            out.close();

            std::string compCmd = "gcc -O2 \"" + srcFile.string() + "\" -o \"" + exeFile.string() + "\"";
            std::string compErr;
            bool ok = runCompiler(compCmd, tempDir.string(), compErr);
            if (!ok || !fs::exists(exeFile)) {
                report.status = "COMPILATION_ERROR";
                report.compilationError = compErr.empty() ? "Compilation failed" : compErr;
                cleanup(tempDir);
                return report;
            }
            execCommand = "\"" + exeFile.string() + "\"";
        } else {
            report.status = "COMPILATION_ERROR";
            report.compilationError = "Unsupported language: " + language;
            cleanup(tempDir);
            return report;
        }

        // Run each testcase
        for (const auto& tc : testCases) {
            TestCaseOutput res;
            res.id = tc.id;
            res.input = tc.input;
            res.expectedOutput = tc.expectedOutput;
            res.isHidden = tc.isHidden;

            runProcessWithLimits(execCommand, tempDir.string(), tc.input, timeLimitMs, res);
            report.details.push_back(res);

            report.totalExecutionTimeMs += res.executionTimeMs;
            if (res.memoryKb > report.peakMemoryKb) {
                report.peakMemoryKb = res.memoryKb;
            }

            if (res.passed) {
                report.passedTestCases++;
            } else if (report.status == "ACCEPTED") {
                if (res.error.find("Time Limit Exceeded") != std::string::npos) {
                    report.status = "TIME_LIMIT_EXCEEDED";
                } else if (!res.error.empty() && res.error.find("Runtime Error") != std::string::npos) {
                    report.status = "RUNTIME_ERROR";
                } else {
                    report.status = "WRONG_ANSWER";
                }
            }
        }

        cleanup(tempDir);
        return report;
    }

private:
    static std::string toLower(std::string s) {
        std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c){ return std::tolower(c); });
        return s;
    }

    static std::string normalize(const std::string& str) {
        std::string s = str;
        s.erase(0, s.find_first_not_of(" \t\r\n"));
        s.erase(s.find_last_not_of(" \t\r\n") + 1);

        std::string out;
        bool inSpace = false;
        for (char c : s) {
            if (c == '\r') continue;
            if (c == ' ' || c == '\t' || c == '\n') {
                if (!inSpace) {
                    out += ' ';
                    inSpace = true;
                }
            } else {
                out += c;
                inSpace = false;
            }
        }
        return out;
    }

    static void cleanup(const fs::path& p) {
        std::error_code ec;
        fs::remove_all(p, ec);
    }

    // ---------------------------------------------------------------------
    // Process execution
    // ---------------------------------------------------------------------
    static constexpr size_t MAX_CAPTURE_BYTES = 64 * 1024;          // per stream
    static constexpr unsigned long long RUN_MEMORY_LIMIT = 256ull * 1024 * 1024;
    static constexpr unsigned long long COMPILE_MEMORY_LIMIT = 1024ull * 1024 * 1024;
    static constexpr unsigned long RUN_PROCESS_LIMIT = 4;      // allows interpreter helpers, blocks fork bombs
    static constexpr unsigned long COMPILE_PROCESS_LIMIT = 8;  // g++ driver + cc1plus + as + ld
    static constexpr int COMPILE_TIMEOUT_MS = 15000;

    static bool createRunDirectory(fs::path& out) {
        std::random_device rd;
        std::ostringstream id;
        id << "eval_" << std::hex << rd() << rd() << rd() << rd();
        out = fs::temp_directory_path() / id.str();
        std::error_code ec;
        // create_directory (not create_directories) fails if it already exists: never reuse a directory
        return fs::create_directory(out, ec) && !ec;
    }

    struct RunOutcome {
        bool launched = false;
        bool timedOut = false;
        bool memoryExceeded = false;
        unsigned long exitCode = 0; // DWORD on Windows
        std::string stdoutData;
        std::string stderrData;
        long long elapsedMs = 0;
        long long peakMemoryKb = 0;
    };

#ifdef _WIN32
    /** Reads a pipe to EOF, keeping at most MAX_CAPTURE_BYTES (the rest is drained and discarded). */
    static void drainPipe(HANDLE h, std::string& out) {
        char buffer[4096];
        DWORD bytesRead = 0;
        while (ReadFile(h, buffer, sizeof(buffer), &bytesRead, NULL) && bytesRead != 0) {
            if (out.size() < MAX_CAPTURE_BYTES) {
                out.append(buffer, std::min<size_t>(bytesRead, MAX_CAPTURE_BYTES - out.size()));
            }
        }
    }

    /**
     * Pipe creation through CreateProcess is serialized so a child launched for one
     * submission can never inherit pipe handles that belong to a concurrent submission.
     */
    static std::mutex& spawnMutex() {
        static std::mutex m;
        return m;
    }

    /**
     * Runs a command inside a Job Object that caps active processes and total memory,
     * blocks UI access, and is terminated as a whole (including grandchildren) on
     * timeout or completion. stdin is fed and stdout/stderr are drained concurrently,
     * so large inputs/outputs can neither deadlock the runner nor exhaust memory.
     */
    static RunOutcome runInJob(const std::string& cmd, const std::string& workingDir,
                               const std::string& input, int timeoutMs,
                               DWORD processLimit, unsigned long long memoryLimit) {
        RunOutcome out;

        HANDLE hJob = CreateJobObjectA(NULL, NULL);
        if (!hJob) return out;
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION li;
        ZeroMemory(&li, sizeof(li));
        li.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE |
                                              JOB_OBJECT_LIMIT_ACTIVE_PROCESS |
                                              JOB_OBJECT_LIMIT_JOB_MEMORY |
                                              JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION;
        li.BasicLimitInformation.ActiveProcessLimit = processLimit;
        li.JobMemoryLimit = (SIZE_T)memoryLimit;
        SetInformationJobObject(hJob, JobObjectExtendedLimitInformation, &li, sizeof(li));
        JOBOBJECT_BASIC_UI_RESTRICTIONS ui;
        ui.UIRestrictionsClass = JOB_OBJECT_UILIMIT_ALL;
        SetInformationJobObject(hJob, JobObjectBasicUIRestrictions, &ui, sizeof(ui));

        SECURITY_ATTRIBUTES sa;
        sa.nLength = sizeof(SECURITY_ATTRIBUTES);
        sa.bInheritHandle = TRUE;
        sa.lpSecurityDescriptor = NULL;

        HANDLE hIn_Rd = NULL, hIn_Wr = NULL, hOut_Rd = NULL, hOut_Wr = NULL, hErr_Rd = NULL, hErr_Wr = NULL;
        PROCESS_INFORMATION pi;
        ZeroMemory(&pi, sizeof(pi));
        BOOL success = FALSE;
        {
            std::lock_guard<std::mutex> lock(spawnMutex());
            if (!CreatePipe(&hIn_Rd, &hIn_Wr, &sa, 0) ||
                !CreatePipe(&hOut_Rd, &hOut_Wr, &sa, 0) ||
                !CreatePipe(&hErr_Rd, &hErr_Wr, &sa, 0)) {
                for (HANDLE h : {hIn_Rd, hIn_Wr, hOut_Rd, hOut_Wr, hErr_Rd, hErr_Wr}) if (h) CloseHandle(h);
                CloseHandle(hJob);
                return out;
            }
            // Parent-side ends must never be inherited
            SetHandleInformation(hIn_Wr, HANDLE_FLAG_INHERIT, 0);
            SetHandleInformation(hOut_Rd, HANDLE_FLAG_INHERIT, 0);
            SetHandleInformation(hErr_Rd, HANDLE_FLAG_INHERIT, 0);

            STARTUPINFOA si;
            ZeroMemory(&si, sizeof(si));
            si.cb = sizeof(si);
            si.hStdInput = hIn_Rd;
            si.hStdOutput = hOut_Wr;
            si.hStdError = hErr_Wr;
            si.dwFlags |= STARTF_USESTDHANDLES;

            std::string cmdCopy = cmd;
            success = CreateProcessA(NULL, cmdCopy.data(), NULL, NULL, TRUE,
                                     CREATE_SUSPENDED | CREATE_NO_WINDOW, NULL,
                                     workingDir.empty() ? NULL : workingDir.c_str(), &si, &pi);
            // Child-side ends are no longer needed in this process
            CloseHandle(hIn_Rd);
            CloseHandle(hOut_Wr);
            CloseHandle(hErr_Wr);
        }

        if (!success) {
            CloseHandle(hIn_Wr);
            CloseHandle(hOut_Rd);
            CloseHandle(hErr_Rd);
            CloseHandle(hJob);
            return out;
        }

        if (!AssignProcessToJobObject(hJob, pi.hProcess)) {
            // Never run user code outside the job
            TerminateProcess(pi.hProcess, 1);
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
            CloseHandle(hIn_Wr);
            CloseHandle(hOut_Rd);
            CloseHandle(hErr_Rd);
            CloseHandle(hJob);
            return out;
        }
        out.launched = true;

        std::thread writer([hIn_Wr, &input] {
            size_t offset = 0;
            while (offset < input.size()) {
                DWORD written = 0;
                DWORD chunk = (DWORD)std::min<size_t>(input.size() - offset, 64 * 1024);
                if (!WriteFile(hIn_Wr, input.data() + offset, chunk, &written, NULL) || written == 0) break;
                offset += written;
            }
            CloseHandle(hIn_Wr);
        });
        std::thread outReader([hOut_Rd, &out] { drainPipe(hOut_Rd, out.stdoutData); });
        std::thread errReader([hErr_Rd, &out] { drainPipe(hErr_Rd, out.stderrData); });

        auto startTime = std::chrono::steady_clock::now();
        ResumeThread(pi.hThread);
        DWORD waitRes = WaitForSingleObject(pi.hProcess, (DWORD)timeoutMs);
        out.elapsedMs = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - startTime).count();
        out.timedOut = (waitRes == WAIT_TIMEOUT);

        // Kill the whole tree: grandchildren holding inherited pipe ends die too,
        // so the reader threads always reach EOF.
        TerminateJobObject(hJob, 1);
        WaitForSingleObject(pi.hProcess, 2000);

        writer.join();
        outReader.join();
        errReader.join();

        GetExitCodeProcess(pi.hProcess, &out.exitCode);

        JOBOBJECT_EXTENDED_LIMIT_INFORMATION usage;
        ZeroMemory(&usage, sizeof(usage));
        if (QueryInformationJobObject(hJob, JobObjectExtendedLimitInformation, &usage, sizeof(usage), NULL)) {
            out.peakMemoryKb = (long long)(usage.PeakJobMemoryUsed / 1024);
            out.memoryExceeded = usage.PeakJobMemoryUsed >= (memoryLimit / 100) * 98;
        }

        CloseHandle(pi.hProcess);
        CloseHandle(pi.hThread);
        CloseHandle(hOut_Rd);
        CloseHandle(hErr_Rd);
        CloseHandle(hJob);
        return out;
    }
#endif

    static bool runCompiler(const std::string& cmd, const std::string& workingDir, std::string& output) {
#ifdef _WIN32
        RunOutcome r = runInJob(cmd, workingDir, "", COMPILE_TIMEOUT_MS, COMPILE_PROCESS_LIMIT, COMPILE_MEMORY_LIMIT);
        if (!r.launched) {
            output = "Failed to launch compilation process";
            return false;
        }
        if (r.timedOut) {
            output = "Compilation timed out";
            return false;
        }
        output = r.stderrData + r.stdoutData;
        return r.exitCode == 0;
#else
        output = "Compilation is only supported on the Windows evaluator build";
        return false;
#endif
    }

    static void runProcessWithLimits(const std::string& cmd,
                                     const std::string& workingDir,
                                     const std::string& input,
                                     int timeoutMs,
                                     TestCaseOutput& result) {
#ifdef _WIN32
        RunOutcome r = runInJob(cmd, workingDir, input, timeoutMs, RUN_PROCESS_LIMIT, RUN_MEMORY_LIMIT);
        result.executionTimeMs = r.elapsedMs;
        result.memoryKb = r.peakMemoryKb;

        if (!r.launched) {
            result.passed = false;
            result.error = "Runtime Error: failed to start the runner process";
            return;
        }
        if (r.timedOut) {
            result.passed = false;
            result.error = "Time Limit Exceeded (> " + std::to_string(timeoutMs) + "ms)";
            return;
        }

        result.actualOutput = r.stdoutData;
        while (!result.actualOutput.empty() && (result.actualOutput.back() == '\n' || result.actualOutput.back() == '\r')) {
            result.actualOutput.pop_back();
        }

        if (r.memoryExceeded) {
            result.passed = false;
            result.error = "Runtime Error: Memory Limit Exceeded (" + std::to_string(RUN_MEMORY_LIMIT / (1024 * 1024)) + " MB)";
            return;
        }
        if (r.exitCode != 0) {
            result.passed = false;
            result.error = "Runtime Error (code " + std::to_string(r.exitCode) + "): " + r.stderrData;
            return;
        }

        result.passed = (normalize(result.expectedOutput) == normalize(result.actualOutput));
        if (!result.passed && !r.stderrData.empty()) {
            result.error = r.stderrData;
        }
#else
        result.passed = false;
        result.error = "Runtime Error: code execution is only supported on the Windows evaluator build";
#endif
    }
};
