# PDF Hub

PDF Hub is a powerful, browser-based utility for viewing and extracting content from multiple PDF documents. It provides a clean, tabbed interface for managing files and offers advanced text extraction capabilities, including an OCR fallback for scanned or image-based PDFs.

This project is built entirely with client-side technologies, meaning all processing happens directly in your browser. No files are ever uploaded to a server, ensuring your data remains private and secure.

## Features

*   **Multi-File Support**: Load one or more PDF files and view each in its own dedicated tab.
*   **Dynamic Tab Management**: Easily add more files using the `+` button or close individual tabs with the `×` button.
*   **High-Fidelity PDF Viewing**: Renders PDFs directly in the browser using `pdf.js`, providing a native viewing experience with zoom and navigation controls.
*   **Advanced Content Extraction**:
    *   Copy content as either structured **plain text** (preserving line breaks) or as high-fidelity **formatted HTML** (preserving layout, fonts, and styles).
    *   "Copy All" feature to extract and concatenate content from all open documents at once.
*   **Optical Character Recognition (OCR)**: Automatically detects image-based (scanned) PDFs and uses `Tesseract.js` to "read" and extract the text content.
*   **Modern UI/UX**:
    *   Clean, full-page, tab-based interface.
    *   Non-intrusive toast notifications for status updates.
    *   Responsive design for a seamless experience.
*   **100% Client-Side**: All processing is done in the browser. Your files are never uploaded, ensuring complete privacy.

## How to Use

1.  **Open `index.html`** in a modern web browser.
2.  **Add Files**: Click the `+` button on the right side of the tab bar to open the file selection dialog. Select one or more PDF files.
3.  **View PDFs**: The selected files will load into individual tabs. The view will default to "Fit to Page".
4.  **Copy Content**:
    *   **Single Document**: Click the copy icon on any tab. A modal will appear allowing you to choose between copying as "Plain Text" or "Formatted HTML".
    *   **All Documents**: Click the "Copy All" icon (multiple pages) in the tab bar to perform the same action for all open documents.
5.  **Manage Tabs**:
    *   Click the `×` button on a tab to close it.
    *   Click the `+` button at any time to add more files to the session.

## Technology Stack

*   **HTML5 / CSS3**: For structure and styling.
*   **JavaScript (ES Modules)**: For all application logic and interactivity.
*   **PDF.js**: A library from Mozilla used for parsing and rendering PDF files in the browser.
*   **Tesseract.js**: A powerful OCR library that recognizes text in images, used here as a fallback for scanned PDFs.