const { pdfjsLib } = window;

const pdfInput = document.getElementById('pdf-input');
const resultsContainer = document.getElementById('results-container');
const tabNav = document.getElementById('tab-nav');
const tabContent = document.getElementById('tab-content');
const spinnerOverlay = document.getElementById('spinner-overlay');
let copyAllBtn = null; // Will be assigned in initializeUI
let addFilesBtn = null; // Will be created dynamically
let newWorker; // To hold the new service worker instance

// Sidenav and Modal elements
const hamburgerBtn = document.getElementById('hamburger-btn');
const sidenav = document.getElementById('sidenav');
const closeSidenavBtn = document.getElementById('close-sidenav-btn');
const aboutBtn = document.getElementById('about-btn');
const checkForUpdatesBtn = document.getElementById('check-for-updates-btn');
const aboutModalOverlay = document.getElementById('about-modal-overlay');
const aboutModalContent = document.getElementById('about-modal-content');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const closeAboutModalBtn = document.getElementById('close-about-modal-btn');

// To keep track of created object URLs for cleanup
let objectUrls = [];
// To store the list of currently loaded files
let loadedFiles = [];

const ICONS = {
    COPY: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1-1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>`,
    COPY_ALL: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2zm10-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z"/><path d="M0 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2z"/></svg>`,
    SUCCESS: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>`
};

function initializeUI() {
    // Create and add the [+] button on initial page load
    addFilesBtn = document.createElement('button');
    addFilesBtn.id = 'add-files-btn';
    addFilesBtn.textContent = '+';
    addFilesBtn.title = 'Add more files';
    addFilesBtn.addEventListener('click', () => pdfInput.click());
    tabNav.appendChild(addFilesBtn);

    copyAllBtn = document.createElement('button');
    copyAllBtn.id = 'copy-all-btn';
    copyAllBtn.addEventListener('click', handleCopyAllClick);
    copyAllBtn.title = 'Copy all documents';
    copyAllBtn.innerHTML = ICONS.COPY_ALL;
    tabNav.insertBefore(copyAllBtn, addFilesBtn);

    // Hide the content area initially, but keep the tab bar visible.
    if (loadedFiles.length === 0) {
        tabContent.classList.add('hidden');
    }
}

/**
 * Copies the provided text content to the clipboard and updates the button state.
 * @param {string} content The text content to copy.
 * @param {HTMLElement} button The button that was clicked.
 */
async function performCopy(content, button) {
    button.disabled = true;
    try {
        await navigator.clipboard.writeText(content);
        button.innerHTML = ICONS.SUCCESS;
        showToast('Copied to clipboard!', 'success');
    } catch (err) {
        console.error('Failed to copy text:', err);
        showToast(`Failed to copy: ${err.message}`, 'error');
        button.innerHTML = 'Error';
    } finally {
        setTimeout(() => {
            // Restore the correct icon based on the button's ID
            button.innerHTML = button.id === 'copy-all-btn' ? ICONS.COPY_ALL : ICONS.COPY;
            button.disabled = false;
        }, 2000);
    }
}

async function handleCopyAllClick() {
    copyAllBtn.disabled = true;
    copyAllBtn.innerHTML = 'Preparing...';

    const textPromises = loadedFiles.map(f => extractTextFromPdf(f));
    const allText = (await Promise.all(textPromises)).join('\n\n---\n\n');

    if (allText) {
        await performCopy(allText, copyAllBtn);
    } else {
        showToast('No text content to copy.', 'info');
        copyAllBtn.disabled = false;
        copyAllBtn.innerHTML = ICONS.COPY_ALL;
    }
}

/**
 * Displays a toast notification.
 * @param {string} message The message to display.
 * @param {string} type The type of toast (info, success, error).
 * @param {number} duration The duration in milliseconds.
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return null;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Use a short timeout to allow the element to be in the DOM before adding the 'show' class for the transition.
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // If duration is 0, the toast is persistent and must be removed manually.
    if (duration > 0) {
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, duration);
    }

    return toast; // Return the toast element so it can be updated
}

/**
 * Handles the PDF to text conversion process when the button is clicked.
 */
async function handleFileSelection(event) {
    const files = event.target.files; // This expects a file input change event
    const isFromParent = event.source === 'goldfin-parent';

    if (files.length === 0) {
        return;
    }
    console.log(`PDF Hub: handleFileSelection called with ${files.length} file(s). Source: ${isFromParent ? 'GoldFin' : 'User Input'}`);
    tabContent.classList.remove('hidden'); // Show the content area
    spinnerOverlay.style.display = 'flex';
    showToast('Processing files...', 'info', 4000);

    try {
        const newFiles = Array.from(files);
        const startingIndex = loadedFiles.length;
        loadedFiles.push(...newFiles); // Append new files to the existing list

        for (let i = 0; i < newFiles.length; i++) {
            const file = newFiles[i];
            const fileCounter = startingIndex + i;
            try {
                // Create a unique ID for the tab and panel
                const tabId = `tab-${fileCounter}`;
                // **THE FIX**: If the file comes from the parent (GoldFin), it's the only new file,
                // and it should always be activated.
                const shouldActivate = isFromParent || (startingIndex === 0 && i === 0);
                createTab(file, tabId, shouldActivate);
                createTabPanel(file, tabId, shouldActivate, fileCounter);
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                showToast(`Failed to process ${file.name}`, 'error');
            }
        }

        if (loadedFiles.length > 0) {
            copyAllBtn.style.display = 'block'; // Show the "Copy All" button
            showToast(`Conversion complete. ${loadedFiles.length} file(s) processed.`, 'success');
        } else {
            showToast('No files were processed.', 'info');
        }
    } finally {
        // Re-enable the button and reset its text when all processing is done
        spinnerOverlay.style.display = 'none';
    }

    // Clear the file input for the next use
    pdfInput.value = '';
}

/**
 * Creates a new tab button in the navigation bar.
 * @param {File} file - The file object for this tab.
 * @param {string} tabId - The unique ID for this tab.
 * @param {boolean} isActive - Whether this should be the active tab.
 */
function createTab(file, tabId, isActive) {
    const fileIndex = loadedFiles.indexOf(file);
    const tabContainer = document.createElement('div');
    tabContainer.className = `tab-container ${isActive ? 'active' : ''}`;
    tabContainer.dataset.tabId = tabId;
    tabContainer.dataset.fileIndex = fileIndex; // Store the file's current index

    // Make the tab draggable
    tabContainer.draggable = true;
    tabContainer.addEventListener('dragstart', handleDragStart);
    tabContainer.addEventListener('dragend', handleDragEnd);

    const tabButton = document.createElement('button');
    tabButton.className = 'tab-btn';
    tabButton.textContent = file.name;
    tabButton.dataset.tab = tabId;

    tabButton.addEventListener('click', () => {
        // Deactivate all tabs and panels
        document.querySelectorAll('.tab-container').forEach(container => container.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

        // Activate the clicked tab and corresponding panel
        tabContainer.classList.add('active');
        document.getElementById(tabId).classList.add('active');
    });

    const copyButton = document.createElement('button');
    copyButton.innerHTML = ICONS.COPY;
    copyButton.className = 'copy-btn';
    copyButton.title = 'Copy this document';

    copyButton.addEventListener('click', async () => {
        copyButton.disabled = true;
        copyButton.innerHTML = 'Preparing...';
        const textContent = await extractTextFromPdf(file);
        await performCopy(textContent, copyButton);
    });

    tabContainer.appendChild(tabButton);

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.className = 'close-tab-btn';
    closeButton.title = 'Remove this tab';
    closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        removeTab(tabContainer, fileIndex);
    });

    tabContainer.appendChild(copyButton);
    tabContainer.appendChild(closeButton);
    // Insert the new tab before the [+] button
    tabNav.insertBefore(tabContainer, addFilesBtn);
}

/**
 * Handles the start of a drag event for a tab.
 * @param {DragEvent} e The drag event.
 */
function handleDragStart(e) {
    e.target.classList.add('dragging');
    // Set data to be transferred (necessary for Firefox)
    e.dataTransfer.setData('text/plain', e.target.dataset.tabId);
    e.dataTransfer.effectAllowed = 'move';
}

/**
 * Handles the end of a drag event for a tab.
 * @param {DragEvent} e The drag event.
 */
function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    updateDataArraysFromDOM();
}

/**
 * Handles the dragover event to determine drop position.
 * @param {DragEvent} e The drag event.
 */
function handleDragOver(e) {
    e.preventDefault(); // Allow dropping
    const draggingTab = document.querySelector('.dragging');
    if (!draggingTab) return;

    const afterElement = getDragAfterElement(tabNav, e.clientX);
    if (afterElement == null) {
        tabNav.insertBefore(draggingTab, addFilesBtn);
    } else {
        tabNav.insertBefore(draggingTab, afterElement);
    }
}

/**
 * Finds the element that the dragged tab should be placed before.
 * @param {HTMLElement} container The tab navigation container.
 * @param {number} x The horizontal position of the mouse.
 * @returns {HTMLElement|null} The element to insert before, or null.
 */
function getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('.tab-container:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function removeTab(tabContainer, fileIndex) {
    const tabId = tabContainer.dataset.tabId;
    const panel = document.getElementById(tabId);

    // Remove from DOM
    if (tabContainer) tabContainer.remove();
    if (panel) panel.remove();

    // Clean up data arrays
    if (fileIndex > -1) {
        loadedFiles.splice(fileIndex, 1);
        const urlToRevoke = objectUrls.splice(fileIndex, 1)[0];
        URL.revokeObjectURL(urlToRevoke);
    }

    // If no tabs are left, hide the container
    if (loadedFiles.length === 0) {
        tabContent.classList.add('hidden'); // Hide only the content area
        document.getElementById('copy-all-btn').style.display = 'none';
    }
}

/**
 * Updates the loadedFiles and objectUrls arrays to match the DOM order.
 */
function updateDataArraysFromDOM() {
    const newLoadedFiles = [];
    const newObjectUrls = [];
    const tabContainers = document.querySelectorAll('.tab-container');
    
    // First, build the new arrays based on the current DOM order
    tabContainers.forEach(container => {
        const fileIndex = parseInt(container.dataset.fileIndex, 10);
        newLoadedFiles.push(loadedFiles[fileIndex]);
        newObjectUrls.push(objectUrls[fileIndex]);
    });
    
    // Now, update the main arrays and re-index the DOM elements
    loadedFiles = newLoadedFiles;
    objectUrls = newObjectUrls;
    document.querySelectorAll('.tab-container').forEach((container, index) => {
        container.dataset.fileIndex = index;
    });
}

/**
 * Creates a new panel to display the extracted text.
 * @param {File} file - The PDF file to display.
 * @param {string} tabId - The unique ID for this panel.
 * @param {boolean} isActive - Whether this should be the active panel.
 */
function createTabPanel(file, tabId, isActive, fileIndex) {
    const tabPanel = document.createElement('div');
    tabPanel.id = tabId;
    tabPanel.className = `tab-panel ${isActive ? 'active' : ''}`;

    const iframe = document.createElement('iframe');
    const fileUrl = URL.createObjectURL(file);
    objectUrls[fileIndex] = fileUrl; // Store URL at the correct index

    // Append #view=FitH to set the default view to "Fit to Width"
    iframe.src = fileUrl + '#view=FitH';
    iframe.title = `PDF Hub: ${file.name}`;

    tabPanel.appendChild(iframe);
    tabContent.appendChild(tabPanel);
}

/**
 * Helper function to read a file as an ArrayBuffer using a Promise.
 * @param {File} file The file to read.
 * @returns {Promise<ArrayBuffer>} A promise that resolves with the file's ArrayBuffer content.
 */
function readFileAsArrayBuffer(file) {
    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
        fileReader.onload = (event) => {
            resolve(event.target.result);
        };
        fileReader.onerror = (error) => {
            reject(error);
        };
        fileReader.readAsArrayBuffer(file);
    });
}

/**
 * Performs OCR on a single PDF page.
 * @param {PDFPageProxy} page The PDF.js page object.
 * @returns {Promise<string>} A promise that resolves with the recognized text.
 */
async function performOcrOnPage(page) {
    let ocrToast = null; // To hold the reference to our toast
    try {
        // Create a persistent toast for OCR progress
        ocrToast = showToast('Starting OCR...', 'info', 0); // 0 duration = persistent

        // Render page to a high-resolution canvas for better OCR accuracy.
        // 300 DPI is a good standard for OCR.
        const scale = 300 / 96;
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        
        // Use Tesseract to recognize text from the canvas.
        const { data: { text } } = await Tesseract.recognize(canvas, 'eng', {
            logger: m => {
                // Update the toast message with live progress
                if (ocrToast && m.status === 'recognizing text') {
                    const progress = (m.progress * 100).toFixed(0);
                    ocrToast.textContent = `OCR: Recognizing Text (${progress}%)`;
                } else if (ocrToast) {
                    ocrToast.textContent = `OCR: ${m.status}...`;
                }
            }
        });

        // OCR is complete, update toast to success and then remove it
        if (ocrToast) {
            ocrToast.textContent = 'OCR Complete!';
            ocrToast.className = 'toast success show'; // Ensure it's visible
            setTimeout(() => ocrToast.remove(), 1500);
        }

        return text;
    } catch (error) {
        console.error('OCR processing failed for a page:', error);
        // If an error occurs, update the toast to show failure
        if (ocrToast) {
            ocrToast.textContent = 'OCR failed for a page.';
            ocrToast.className = 'toast error show';
            setTimeout(() => ocrToast.remove(), 3000);
        }
        return ''; // Return empty string on failure
    }
}

/**
 * Reads a PDF file and extracts all text content from its pages.
 * @param {File} file - The PDF file object.
 * @returns {Promise<string>} A promise that resolves with the extracted text.
 */
async function extractTextFromPdf(file) {
    try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const typedarray = new Uint8Array(arrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // If textContent is empty, it's likely a scanned/image page.
            if (textContent.items.length > 0) {
                // Sort items by their vertical, then horizontal position.
                const sortedItems = textContent.items.sort((a, b) => {
                    const yComparison = b.transform[5] - a.transform[5]; // Compare Y-coordinate
                    if (Math.abs(yComparison) < 2) { // If on the same line
                        return a.transform[4] - b.transform[4]; // Compare X-coordinate
                    }
                    return yComparison;
                });

                let lastY = sortedItems[0].transform[5];
                let pageText = '';
                for (const item of sortedItems) {
                    if (Math.abs(item.transform[5] - lastY) > item.height) {
                        pageText += '\n';
                    }
                    pageText += item.str;
                    lastY = item.transform[5];
                }
                fullText += pageText + '\n\n'; // Add space between pages
            } else {
                // Fallback to OCR
                // The OCR function will now show its own detailed progress toasts.
                const ocrText = await performOcrOnPage(page);
                fullText += ocrText + '\n\n';
            }
        }

        return fullText.trim();
    } catch (error) {
        throw error; // Re-throw the error to be caught by the caller
    }
}

function setupSidenav() {
    hamburgerBtn.addEventListener('click', (e) => {
        sidenav.style.width = '250px';
        e.stopPropagation(); // Prevent this click from being caught by the window listener
    });

    closeSidenavBtn.addEventListener('click', () => {
        sidenav.style.width = '0';
    });

    aboutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        sidenav.style.width = '0'; // Close the side panel
        showReadmeModal();
    });

    closeAboutModalBtn.addEventListener('click', () => {
        aboutModalOverlay.style.display = 'none';
    });

    // Add a global click listener to close the sidenav when clicking outside
    window.addEventListener('click', (e) => {
        if (sidenav.style.width === '250px' && !sidenav.contains(e.target)) {
            sidenav.style.width = '0';
        }
    });

    aboutModalOverlay.addEventListener('click', (e) => {
        if (e.target === aboutModalOverlay) {
            aboutModalOverlay.style.display = 'none';
        }
    });

    checkForUpdatesBtn.addEventListener('click', () => {
        if (newWorker) {
            newWorker.postMessage({ action: 'skipWaiting' });
        }
    });

    // Theme switching logic
    darkModeToggle.addEventListener('change', () => {
        if (darkModeToggle.checked) {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        }
    });
}

async function showReadmeModal() {
    aboutModalOverlay.style.display = 'flex';
    let originalHTML = '';
    const contentArea = document.getElementById('about-modal-content');
    contentArea.innerHTML = '<p>Loading...</p>';

    try {
        const response = await fetch('README.md');
        if (!response.ok) throw new Error('README.md file not found.');

        const markdown = await response.text();
        originalHTML = parseMarkdown(markdown);
        contentArea.innerHTML = originalHTML;

        const searchInput = document.getElementById('readme-search-input');
        const searchCount = document.getElementById('readme-search-count');
        const clearButton = document.querySelector('.clear-search-btn[data-target="readme-search-input"]');

        searchInput.oninput = () => {
            const searchTerm = searchInput.value.trim();
            contentArea.innerHTML = originalHTML; // Reset content
            clearButton.classList.toggle('hidden', searchTerm === '');
            if (searchTerm === '') {
                searchCount.textContent = '';
                return;
            }
            const regex = new RegExp(searchTerm, 'gi');
            let matches = 0;
            const newHTML = originalHTML.replace(regex, (match) => {
                matches++;
                return `<mark>${match}</mark>`;
            });
            contentArea.innerHTML = newHTML;
            searchCount.textContent = `${matches} found`;
            const firstMark = contentArea.querySelector('mark');
            if (firstMark) firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };

        clearButton.onclick = () => {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
        };

    } catch (error) {
        console.error('Error fetching README:', error);
        contentArea.innerHTML = `<p style="color: red;">Error: Could not load README.md.</p>`;
    }
}

/**
 * Parses a string of Markdown text into HTML.
 * @param {string} markdown The Markdown text to parse.
 * @returns {string} The resulting HTML string.
 */
function parseMarkdown(markdown) {
    let html = markdown
        // General inline replacements
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Headings
        .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
        .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Horizontal Rules
        .replace(/^\s*---*\s*$/gm, '<hr>')
        // Unordered Lists
        .replace(/^\s*[-*] (.*)/gm, '<li>$1</li>')
        .replace(/<\/li>\n<li>/g, '</li><li>') // Join consecutive list items
        .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
        // Ordered Lists
        .replace(/^\s*\d+\. (.*)/gm, '<oli>$1</oli>') // Use a temporary tag
        .replace(/<\/oli>\n<oli>/g, '</oli><oli>')
        .replace(/(<oli>.*<\/oli>)/gs, '<ol>$1</ol>')
        .replace(/<oli>/g, '<li>').replace(/<\/oli>/g, '</li>') // Replace temp tag
        // Paragraphs (any line that isn't a special tag)
        .replace(/^(?!<[h1-6r]|<[ou]l>|<li>).+$/gm, (match) => {
            // Avoid wrapping empty lines or lines that are already part of a list
            if (match.trim() === '' || match.startsWith('<li>')) {
                return match;
            }
            return `<p>${match}</p>`;
        })
        .replace(/<p><\/p>/g, ''); // Clean up empty paragraphs
    return html;
}

function setupPwaUpdateFlow() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('../sw.js').then(reg => {
            console.log('Service Worker registered with scope:', reg.scope);
            reg.addEventListener('updatefound', () => {
                // A new service worker is installing.
                newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    // Has the new service worker finished installing?
                    if (newWorker.state === 'installed') {
                        // Are there any clients currently controlled by the old service worker?
                        if (navigator.serviceWorker.controller) {
                            // Show the "Update Available" button
                            checkForUpdatesBtn.style.display = 'block';
                            showToast('A new version is available!', 'info', 0);
                        }
                    }
                });
            });
        }).catch(error => {
            console.error('Service Worker registration failed:', error);
        });

        let refreshing;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            window.location.reload();
            refreshing = true;
        });
    }
}

// Wait for the DOM to be fully loaded before running setup code
document.addEventListener('DOMContentLoaded', () => {
    initializeUI();

    // Apply saved theme on load
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        darkModeToggle.checked = true;
    }

    setupSidenav();
    setupPwaUpdateFlow();
    pdfInput.addEventListener('change', handleFileSelection); // File selection triggers the main logic
    tabNav.addEventListener('dragover', handleDragOver);

    // Announce that the PDF Hub is ready to receive files from a parent window.
    // The '*' targetOrigin is acceptable for local development.
    window.parent.postMessage({ type: 'pdf-hub-ready' }, '*');
});

/**
 * Listens for 'message' events from a parent window.
 * This allows GoldFin to pass a PDF file directly into the PDF Hub.
 */
window.addEventListener('message', (event) => {
    // Basic security check: ensure the message is from a trusted origin if this were on a public server.
    // For file:// or localhost, we can be less strict.
    if (event.data && event.data.type === 'load-pdf-file' && event.data.file instanceof File && event.data.source === 'goldfin') {
        console.log('PDF Hub received file from parent:', event.data.file);
        // Create a fake event object to pass to the existing file handler
        const fakeEvent = { target: { files: [event.data.file] }, source: 'goldfin-parent' };
        handleFileSelection(fakeEvent);
    }
});
