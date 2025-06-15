// static/js/script.js
document.addEventListener('DOMContentLoaded', function() {
    const resumeForm = document.getElementById('resume-form');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const overallElement = document.getElementById('overall');
    const sectionsElement = document.getElementById('sections');
    const suggestionsList = document.getElementById('suggestions-list');
    const downloadBtn = document.getElementById('download-feedback');
    const uploadNewBtn = document.getElementById('upload-new');
    
    let currentFeedback = null;
    
    if (resumeForm) {
        resumeForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(resumeForm);
            const fileInput = document.getElementById('resume');
            
            // Validate file
            if (fileInput.files.length === 0) {
                alert('Please select a file to upload');
                return;
            }
            
            // Show loading spinner
            resumeForm.classList.add('hidden');
            loading.classList.remove('hidden');
            
            // Upload file
            fetch('/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Hide loading, show results
                loading.classList.add('hidden');
                results.classList.remove('hidden');
                
                // Store the feedback data
                currentFeedback = data;
                
                // Display overall feedback
                overallElement.innerHTML = '';
                data.feedback.overall.forEach(item => {
                    const p = document.createElement('p');
                    p.textContent = item;
                    overallElement.appendChild(p);
                });
                
                // Display sections feedback
                sectionsElement.innerHTML = '';
                const sections = data.feedback.sections;
                for (const [section, present] of Object.entries(sections)) {
                    const div = document.createElement('div');
                    div.className = `section-item ${present ? 'present' : 'missing'}`;
                    
                    const title = document.createElement('h4');
                    title.textContent = section.charAt(0).toUpperCase() + section.slice(1);
                    
                    const status = document.createElement('p');
                    status.textContent = present ? '✅ Present' : '❌ Missing';
                    
                    div.appendChild(title);
                    div.appendChild(status);
                    sectionsElement.appendChild(div);
                }
                
                // Display suggestions
                suggestionsList.innerHTML = '';
                data.feedback.improvement_suggestions.forEach(suggestion => {
                    const li = document.createElement('li');
                    li.textContent = suggestion;
                    suggestionsList.appendChild(li);
                });
            })
            .catch(error => {
                loading.classList.add('hidden');
                resumeForm.classList.remove('hidden');
                alert('Error uploading resume: ' + error.message);
                console.error('Error:', error);
            });
        });
    }
    
    // Handle "Upload New Resume" button
    if (uploadNewBtn) {
        uploadNewBtn.addEventListener('click', function() {
            results.classList.add('hidden');
            resumeForm.classList.remove('hidden');
            resumeForm.reset();
        });
    }
    
    // Handle "Download Feedback" button
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            if (!currentFeedback) return;
            
            // Create feedback text
            let feedbackText = "Resume Critique Report\n";
            feedbackText += "======================\n\n";
            
            // Add overall assessment
            feedbackText += "OVERALL ASSESSMENT:\n";
            currentFeedback.feedback.overall.forEach(item => {
                feedbackText += "- " + item + "\n";
            });
            feedbackText += "\n";
            
            // Add sections feedback
            feedbackText += "RESUME SECTIONS:\n";
            const sections = currentFeedback.feedback.sections;
            for (const [section, present] of Object.entries(sections)) {
                const sectionName = section.charAt(0).toUpperCase() + section.slice(1);
                feedbackText += `- ${sectionName}: ${present ? 'Present' : 'Missing'}\n`;
            }
            feedbackText += "\n";
            
            // Add improvement suggestions
            feedbackText += "IMPROVEMENT SUGGESTIONS:\n";
            currentFeedback.feedback.improvement_suggestions.forEach(suggestion => {
                feedbackText += "- " + suggestion + "\n";
            });
            
            // Create and download the file
            const blob = new Blob([feedbackText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'resume_feedback.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
    
    // Handle view feedback on history page
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const url = this.getAttribute('href');
            
            fetch(url)
                .then(response => response.json())
                .then(data => {
                    // Open a new window with the feedback
                    const win = window.open('', '_blank');
                    
                    // Parse the feedback string back to an object
                    let feedback;
                    try {
                        feedback = JSON.parse(data.feedback.replace(/'/g, '"'));
                    } catch (err) {
                        feedback = {
                            overall: ["Unable to parse feedback"],
                            sections: {},
                            improvement_suggestions: []
                        };
                    }
                    
                    // Create HTML content for the new window
                    win.document.write(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Resume Feedback - ${data.original_filename}</title>
                            <style>
                                body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
                                h1, h2, h3 { color: #334e68; }
                                .section { margin-bottom: 20px; }
                                .section-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
                                .section-item { padding: 15px; border-radius: 5px; text-align: center; }
                                .present { background-color: #e6f7ee; }
                                .missing { background-color: #ffeeee; }
                                ul { margin-left: 20px; }
                            </style>
                        </head>
                        <body>
                            <h1>Resume Feedback</h1>
                            <p><strong>File:</strong> ${data.original_filename}</p>
                            <p><strong>Date:</strong> ${new Date(data.created_at).toLocaleString()}</p>
                            
                            <div class="section">
                                <h2>Overall Assessment</h2>
                                <div>${feedback.overall.map(item => `<p>${item}</p>`).join('')}</div>
                            </div>
                            
                            <div class="section">
                                <h2>Resume Sections</h2>
                                <div class="section-grid">
                                    ${Object.entries(feedback.sections).map(([section, present]) => `
                                        <div class="section-item ${present ? 'present' : 'missing'}">
                                            <h3>${section.charAt(0).toUpperCase() + section.slice(1)}</h3>
                                            <p>${present ? '✅ Present' : '❌ Missing'}</p>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            
                            <div class="section">
                                <h2>Improvement Suggestions</h2>
                                <ul>
                                    ${feedback.improvement_suggestions.map(item => `<li>${item}</li>`).join('')}
                                </ul>
                            </div>
                        </body>
                        </html>
                    `);
                })
                .catch(error => {
                    console.error('Error fetching resume data:', error);
                    alert('Error loading resume feedback');
                });
        });
    });
});