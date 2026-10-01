#pragma once

#include "JuceHeader.h"

#include <functional>
#include <memory>

namespace file_dialogs {

  inline void browse(const String& title, const File& start, const String& filters, int flags,
                     std::function<void(const File&)> on_chosen) {
    std::shared_ptr<FileChooser> chooser = std::make_shared<FileChooser>(title, start, filters);
    chooser->launchAsync(flags, [chooser, on_chosen](const FileChooser& result) {
      File file = result.getResult();
      if (file != File() && on_chosen)
        on_chosen(file);
    });
  }

  inline void openFile(const String& title, const File& start, const String& filters,
                       std::function<void(const File&)> on_chosen) {
    browse(title, start, filters, FileBrowserComponent::openMode | FileBrowserComponent::canSelectFiles,
           std::move(on_chosen));
  }

  inline void saveFile(const String& title, const File& start, const String& filters,
                       std::function<void(const File&)> on_chosen) {
    browse(title, start, filters, FileBrowserComponent::saveMode | FileBrowserComponent::canSelectFiles |
                                  FileBrowserComponent::warnAboutOverwriting, std::move(on_chosen));
  }

  inline void openFiles(const String& title, const File& start, const String& filters,
                        std::function<void(const Array<File>&)> on_chosen) {
    std::shared_ptr<FileChooser> chooser = std::make_shared<FileChooser>(title, start, filters);
    int flags = FileBrowserComponent::openMode | FileBrowserComponent::canSelectFiles |
                FileBrowserComponent::canSelectMultipleItems;
    chooser->launchAsync(flags, [chooser, on_chosen](const FileChooser& result) {
      Array<File> files = result.getResults();
      if (!files.isEmpty() && on_chosen)
        on_chosen(files);
    });
  }

  inline void chooseDirectory(const String& title, const File& start,
                              std::function<void(const File&)> on_chosen) {
    browse(title, start, "*", FileBrowserComponent::openMode | FileBrowserComponent::canSelectDirectories,
           std::move(on_chosen));
  }
}
