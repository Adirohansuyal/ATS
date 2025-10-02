document.addEventListener('DOMContentLoaded', () => {
    const themeSwitch = document.getElementById('checkbox');
    const body = document.body;

    const currentTheme = localStorage.getItem('theme');

    if (currentTheme) {
        body.classList.add(currentTheme);
        if (currentTheme === 'dark-mode') {
            themeSwitch.checked = true;
        }
    }

    themeSwitch.addEventListener('change', function() {
        if(this.checked) {
            body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark-mode');
        } else {
            body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light-mode');
        }
    });

    const jobDescEl = document.getElementById('job-desc');
    const resumeUploadEl = document.getElementById('resume-upload');
    const scoreButton = document.getElementById('score-button');
    const resultsEl = document.getElementById('results');
    const scoreEl = document.getElementById('score');
    const progressBar = document.querySelector('.progress');
    const missingKeywordsEl = document.getElementById('missing-keywords');
    const resumePreviewEl = document.getElementById('resume-preview');

    resumeUploadEl.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const pdfData = new Uint8Array(e.target.result);
                renderPDF(pdfData);
            };
            reader.readAsArrayBuffer(file);
        }
    });

    async function renderPDF(pdfData) {
        resumePreviewEl.innerHTML = '';
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            await page.render(renderContext).promise;
            resumePreviewEl.appendChild(canvas);
        }
    }

    scoreButton.addEventListener('click', async () => {
        const jobDesc = jobDescEl.value;
        const resumeFile = resumeUploadEl.files[0];

        let resumeContent = '';

        if (resumeFile) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const pdfData = new Uint8Array(event.target.result);
                const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    resumeContent += textContent.items.map(item => item.str).join(' ');
                }
                sendToServer(jobDesc, resumeContent);
            };
            reader.readAsArrayBuffer(resumeFile);
        } else {
            alert('Please upload a resume.');
        }
    });

    async function sendToServer(jobDesc, resumeText) {
        resultsEl.classList.remove('visible');
        resultsEl.classList.add('hidden');
        scoreButton.disabled = true;
        scoreButton.innerHTML = '<span class="spinner"></span>Scoring...';

        try {
            const response = await fetch('https://ats-7-0bmx.onrender.com/score', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ job_desc: jobDesc, resume_text: resumeText }),
            });

            const data = await response.json();

            if (response.ok) {
                let formattedResult = data.ats_result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                formattedResult = formattedResult.replace(/\n/g, '<br>');
                scoreEl.innerHTML = formattedResult;
                progressBar.style.width = `${data.match_percentage}%`;
                progressBar.textContent = data.match_percentage > 0 ? `${data.match_percentage}%` : '';
                missingKeywordsEl.textContent = data.missing_keywords.join(', ');
                resultsEl.classList.remove('hidden');
                resultsEl.classList.add('visible');
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while scoring the resume.');
        } finally {
            scoreButton.disabled = false;
            scoreButton.textContent = 'Score Resume';
        }
    }
});
