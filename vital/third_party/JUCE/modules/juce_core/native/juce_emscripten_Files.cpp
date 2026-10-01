namespace juce
{

bool File::isOnCDRomDrive() const      { return false; }
bool File::isOnHardDisk() const        { return true; }
bool File::isOnRemovableDrive() const  { return false; }

String File::getVersion() const
{
    return {}; // xxx not yet implemented
}

//==============================================================================
static File resolveXDGFolder (const char* const type, const char* const fallbackFolder)
{
    StringArray confLines;
    File ("~/.config/user-dirs.dirs").readLines (confLines);

    for (int i = 0; i < confLines.size(); ++i)
    {
        const String line (confLines[i].trimStart());

        if (line.startsWith (type))
        {
            // eg. resolve XDG_MUSIC_DIR="$HOME/Music" to /home/user/Music
            const File f (line.replace ("$HOME", File ("~").getFullPathName())
                              .fromFirstOccurrenceOf ("=", false, false)
                              .trim().unquoted());

            if (f.isDirectory())
                return f;
        }
    }

    return File (fallbackFolder);
}

const char* const* juce_argv = nullptr;
int juce_argc = 0;

File File::getSpecialLocation (const SpecialLocationType type)
{
    switch (type)
    {
        case userHomeDirectory:
        {
            if (const char* homeDir = getenv ("HOME"))
                return File (CharPointer_UTF8 (homeDir));

            if (auto* pw = getpwuid (getuid()))
                return File (CharPointer_UTF8 (pw->pw_dir));

            return {};
        }

        case userDocumentsDirectory:          return resolveXDGFolder ("XDG_DOCUMENTS_DIR", "~/Documents");
        case userMusicDirectory:              return resolveXDGFolder ("XDG_MUSIC_DIR",     "~/Music");
        case userMoviesDirectory:             return resolveXDGFolder ("XDG_VIDEOS_DIR",    "~/Videos");
        case userPicturesDirectory:           return resolveXDGFolder ("XDG_PICTURES_DIR",  "~/Pictures");
        case userDesktopDirectory:            return resolveXDGFolder ("XDG_DESKTOP_DIR",   "~/Desktop");
        case userApplicationDataDirectory:    return resolveXDGFolder ("XDG_CONFIG_HOME",   "~/.config");
        case commonDocumentsDirectory:
        case commonApplicationDataDirectory:  return File ("/opt");
        case globalApplicationsDirectory:     return File ("/usr");

        case tempDirectory:
        {
            if (const char* tmpDir = getenv ("TMPDIR"))
                return File (CharPointer_UTF8 (tmpDir));

            return File ("/tmp");
        }

        case invokedExecutableFile:
            if (juce_argv != nullptr && juce_argc > 0)
                return File (CharPointer_UTF8 (juce_argv[0]));
            // Falls through
            JUCE_FALLTHROUGH

        case currentExecutableFile:
        case currentApplicationFile:
            // deliberate fall-through if this is not a shared-library
            JUCE_FALLTHROUGH

        case hostApplicationPath:
            return File ("/app/vial");

        default:
            jassertfalse; // unknown type?
            break;
    }

    return {};
}

//==============================================================================
bool File::moveToTrash() const
{
    if (! exists())
        return true;

    File trashCan ("~/.Trash");

    if (! trashCan.isDirectory())
        trashCan = "~/.local/share/Trash/files";

    if (! trashCan.isDirectory())
        return false;

    return moveFileTo (trashCan.getNonexistentChildFile (getFileNameWithoutExtension(),
                                                         getFileExtension()));
}

//==============================================================================
static bool isFileExecutable (const String& filename)
{
    juce_statStruct info;

    return juce_stat (filename, info)
            && S_ISREG (info.st_mode)
            && access (filename.toUTF8(), X_OK) == 0;
}

bool Process::openDocument (const String& fileName, const String&)
{
    MAIN_THREAD_EM_ASM ({
        var target = UTF8ToString ($0);
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test (target) && ! /^file:/i.test (target))
            window.open (target, "_blank", "noopener");
    }, fileName.toRawUTF8());
    return true;
}

void File::revealToUser() const
{
}

}
