namespace juce
{

void Logger::outputDebugString (const String& text)
{
    std::cerr << text << std::endl;
}

SystemStats::OperatingSystemType SystemStats::getOperatingSystemType()
{
    return Linux;
}

String SystemStats::getOperatingSystemName()
{
    return "WebAssembly";
}

bool SystemStats::isOperatingSystem64Bit()
{
    return false;
}

String SystemStats::getDeviceDescription()
{
    char* ua = (char*) MAIN_THREAD_EM_ASM_PTR ({
        var s = (typeof navigator !== 'undefined') ? navigator.userAgent : "";
        var n = lengthBytesUTF8 (s) + 1;
        var p = _malloc (n);
        stringToUTF8 (s, p, n);
        return p;
    });
    String result = String::fromUTF8 (ua);
    free (ua);
    return result;
}

String SystemStats::getDeviceManufacturer()  { return {}; }
String SystemStats::getCpuVendor()           { return "WebAssembly"; }
String SystemStats::getCpuModel()            { return "WebAssembly"; }
int SystemStats::getCpuSpeedInMegahertz()    { return 0; }

int SystemStats::getMemorySizeInMegabytes()
{
    return 2048;
}

int SystemStats::getPageSize()
{
    return 65536;
}

String SystemStats::getLogonName()           { return "web_user"; }
String SystemStats::getFullUserName()        { return getLogonName(); }
String SystemStats::getComputerName()        { return "browser"; }

static String getBrowserLanguage()
{
    char* lang = (char*) MAIN_THREAD_EM_ASM_PTR ({
        var s = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : "en-US";
        var n = lengthBytesUTF8 (s) + 1;
        var p = _malloc (n);
        stringToUTF8 (s, p, n);
        return p;
    });
    String result = String::fromUTF8 (lang);
    free (lang);
    return result;
}

String SystemStats::getUserLanguage()     { return getBrowserLanguage().upToFirstOccurrenceOf ("-", false, false); }
String SystemStats::getUserRegion()       { return getBrowserLanguage().fromFirstOccurrenceOf ("-", false, false); }
String SystemStats::getDisplayLanguage()  { return getBrowserLanguage(); }

void CPUInformation::initialise() noexcept
{
   #if __SSE2__
    hasSSE = true;
    hasSSE2 = true;
   #endif

    numLogicalCPUs = MAIN_THREAD_EM_ASM_INT ({
        return (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : 4;
    });

    numPhysicalCPUs = numLogicalCPUs;
}

uint32 juce_millisecondsSinceStartup() noexcept
{
    return (uint32) (Time::getHighResolutionTicks() / 1000);
}

int64 Time::getHighResolutionTicks() noexcept
{
    timespec t;
    clock_gettime (CLOCK_MONOTONIC, &t);
    return (t.tv_sec * (int64) 1000000) + (t.tv_nsec / 1000);
}

int64 Time::getHighResolutionTicksPerSecond() noexcept
{
    return 1000000;
}

double Time::getMillisecondCounterHiRes() noexcept
{
    return (double) getHighResolutionTicks() * 0.001;
}

bool Time::setSystemTimeToThisTime() const
{
    return false;
}

JUCE_API bool JUCE_CALLTYPE juce_isRunningUnderDebugger() noexcept
{
    return false;
}

}
