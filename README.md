# PDF Hub

PDF Hub is a powerful, browser-based utility for viewing and extracting content from multiple PDF documents. It provides a clean, tabbed interface for managing files and offers advanced text extraction capabilities, including an OCR fallback for scanned or image-based PDFs.

This project is built entirely with client-side technologies, meaning all processing happens directly in your browser. No files are ever uploaded to a server, ensuring your data remains private and secure.

## Features

*   **Multi-File Support**: Load one or more PDF files and view each in its own dedicated tab.
*   **Dynamic Tab Management**: Easily add more files using the `+` button or close individual tabs with the `×` button.
*   **Native PDF Viewing**: Leverages the browser's built-in PDF viewer for a high-fidelity experience, complete with native zoom and navigation controls.
*   **Advanced Content Extraction**:
    *   Copies content as structured **plain text**, preserving line breaks where possible.
    *   "Copy All" feature to extract and concatenate text from all open documents at once.
*   **Optical Character Recognition (OCR)**: Automatically detects image-based (scanned) PDFs and uses `Tesseract.js` to "read" and extract the text content.
*   **Modern UI/UX**:
    *   Clean, full-page, tab-based interface.
    *   Non-intrusive toast notifications for status updates.
    *   Responsive design for a seamless experience.
*   **Installable PWA**: Can be installed as a Progressive Web App for offline access and a native-like feel.
*   **100% Client-Side**: All processing is done in the browser. Your files are never uploaded, ensuring complete privacy.

## How to Use

1.  **Open `index.html`** in a modern web browser.
2.  **Add Files**: Click the `+` button on the right side of the tab bar to open the file selection dialog. Select one or more PDF files.
3.  **View PDFs**: The selected files will load into individual tabs. The view will default to "Fit to Width".
4.  **Copy Content**:
    *   **Single Document**: Click the copy icon on any tab to copy its text content to your clipboard.
    *   **All Documents**: Click the "Copy All" icon (multiple pages) in the tab bar to copy the text content of all open documents.
5.  **Manage Tabs**:
    *   Click the `×` button on a tab to close it.
    *   Click the `+` button at any time to add more files to the session.
6.  **Install**: Look for the install icon in your browser's address bar to add PDF Hub to your device for easy offline access.

## Technology Stack

*   **HTML5 / CSS3**: For structure and styling.
*   **JavaScript (ES Modules)**: For all application logic and interactivity.
*   **PDF.js**: A library from Mozilla used for parsing and extracting text content from PDF files.
*   **Tesseract.js**: A powerful OCR library that recognizes text in images, used here as a fallback for scanned PDFs.