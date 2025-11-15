const { pdfjsLib } = window;

// Set the worker source for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://mozilla.github.io/pdf.js/build/pdf.worker.mjs`; 

const pdfInput = document.getElementById('pdf-input');
const resultsContainer = document.getElementById('results-container');
const tabNav = document.getElementById('tab-nav');
const tabContent = document.getElementById('tab-content');
const spinnerOverlay = document.getElementById('spinner-overlay');
const copyModalOverlay = document.getElementById('copy-modal-overlay');
const copyAsTextBtn = document.getElementById('copy-as-text-btn');
const copyAsHtmlBtn = document.getElementById('copy-as-html-btn');
let copyAllBtn = null; // Will be assigned in initializeUI
let addFilesBtn = null; // Will be created dynamically

// To keep track of created object URLs for cleanup
let objectUrls = [];
// To store the list of currently loaded files
let loadedFiles = [];
// To temporarily hold the file and button for the active copy operation
let activeCopyContext = { file: null, button: null, textContent: null, htmlContent: null };

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

// Set up modal button listeners once
copyAsTextBtn.addEventListener('click', () => performCopy('Text', activeCopyContext.textContent));
copyAsHtmlBtn.addEventListener('click', () => performCopy('HTML', activeCopyContext.htmlContent));

async function performCopy(format, content) {
    const { button } = activeCopyContext;
    if (!content || !button) return;

    hideCopyModal();

    // If a specific button was clicked, update it. Otherwise, update the 'Copy All' button.
    const targetButton = button || copyAllBtn;
    targetButton.disabled = true;

    try {
        await navigator.clipboard.writeText(content);
        targetButton.innerHTML = ICONS.SUCCESS;
    } catch (err) {
        console.error(`Failed to copy ${format}:`, err);
        showToast(`Failed to copy: ${err.message}`, 'error');
        targetButton.innerHTML = 'Error';
    } finally {
        setTimeout(() => {
            // If 'button' exists, it was a single tab's copy button. Otherwise, it was the 'Copy All' button.
            if (button) {
                targetButton.innerHTML = ICONS.COPY;
            } else {
                targetButton.innerHTML = ICONS.COPY_ALL;
            }
            targetButton.disabled = false;
        }, 2000);
    }
}

async function handleCopyAllClick() {
    const button = copyAllBtn;
    button.disabled = true;
    button.innerHTML = 'Preparing...';

    const textPromises = loadedFiles.map(f => extractTextFromPdf(f));
    const htmlPromises = loadedFiles.map(f => extractHtmlFromPdf(f));

    const allText = (await Promise.all(textPromises)).join('\n\n---\n\n');
    const allHtml = (await Promise.all(htmlPromises)).join('<hr>');

    activeCopyContext = { file: null, button: button, textContent: allText, htmlContent: allHtml };
    showCopyModal();
}

// Close the side panel if a click occurs outside of it
window.addEventListener('click', (event) => {    
    if (event.target === copyModalOverlay) { // Click on the modal background
        hideCopyModal();
    }
});

function showCopyModal() {
    copyModalOverlay.style.display = 'flex';
}

function hideCopyModal() {
    copyModalOverlay.style.display = 'none';
    // If the copy operation was for "Copy All", reset its button state
    // This handles the case where the user closes the modal without choosing.
    if (activeCopyContext.button === copyAllBtn) {
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
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
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
        copyButton.innerHTML = '...';

        // Pre-extract both formats when the user clicks the tab's copy button
        const textContent = await extractTextFromPdf(file);
        const htmlContent = await extractHtmlFromPdf(file);

        // Set the context for the modal
        activeCopyContext = { file: file, button: copyButton, textContent, htmlContent };
        showCopyModal();
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
 * Reads a PDF file and extracts all text content from its pages.
 * @param {File} file - The PDF file object.
 * @returns {Promise<string>} A promise that resolves with the extracted text.
 */
async function extractTextFromPdf(file) {
    const fileReader = new FileReader();

    return new Promise((resolve, reject) => {
        fileReader.onload = async (event) => {
            try {
                const typedarray = new Uint8Array(event.target.result);
                const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
                let fullText = '';

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();

                    if (textContent.items.length === 0) continue;

                    // Sort items by their vertical, then horizontal position.
                    // This is crucial for reconstructing the text flow.
                    const sortedItems = textContent.items.sort((a, b) => {
                        const yComparison = b.transform[5] - a.transform[5]; // Compare Y-coordinate (top-to-bottom)
                        if (Math.abs(yComparison) < 2) { // If on the same line (within a small tolerance)
                            return a.transform[4] - b.transform[4]; // Compare X-coordinate (left-to-right)
                        }
                        return yComparison;
                    });

                    let lastY = sortedItems[0].transform[5];
                    let pageText = '';
                    for (const item of sortedItems) {
                        // If the Y position of the current item is significantly different from the last,
                        // it's a new line.
                        if (Math.abs(item.transform[5] - lastY) > item.height) {
                            pageText += '\n';
                        }
                        pageText += item.str;
                        lastY = item.transform[5];
                    }
                    fullText += pageText;
                }

                resolve(fullText.trim());
            } catch (error) {
                reject(error);
            }
        };

        fileReader.onerror = (error) => reject(error);
        fileReader.readAsArrayBuffer(file);
    });
}

/**
 * Reads a PDF file and extracts its content as structured HTML.
 * @param {File} file - The PDF file object.
 * @returns {Promise<string>} A promise that resolves with the generated HTML.
 */
async function extractHtmlFromPdf(file) {
    const fileReader = new FileReader();

    return new Promise((resolve, reject) => {
        fileReader.onload = async (event) => {
            try {
                const typedarray = new Uint8Array(event.target.result);
                const loadingTask = pdfjsLib.getDocument({
                    data: typedarray,
                    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
                    cMapPacked: true,
                });
                const pdf = await loadingTask.promise;
                let fullHtml = '';

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.0 });
                    const textContent = await page.getTextContent();

                    let pageHtml = `<div style="position: relative; width:${viewport.width}px; height:${viewport.height}px; border: 1px solid #ccc; margin: 1rem auto; background-color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">`;

                    for (const item of textContent.items) {
                        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                        const style = [
                            `position: absolute`,
                            `left:${tx[4]}px`,
                            `top:${tx[5]}px`,
                            `font-size:${item.height}px`,
                            `font-family:${item.fontName}`,
                        ].join('; ');

                        const sanitizedText = item.str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        pageHtml += `<span style="${style}">${sanitizedText}</span>`;
                    }

                    pageHtml += '</div>';
                    fullHtml += pageHtml;
                }

                resolve(fullHtml);
            } catch (error) {
                reject(error);
            }
        };
        fileReader.onerror = (error) => reject(error);
        fileReader.readAsArrayBuffer(file);
    });
}

// Wait for the DOM to be fully loaded before running setup code
document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
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
