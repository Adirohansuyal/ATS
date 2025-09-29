document.addEventListener('DOMContentLoaded', () => {
    const jobDescEl = document.getElementById('job-desc');
    const resumeUploadEl = document.getElementById('resume-upload');
    const resumeTextEl = document.getElementById('resume-text');
    const scoreButton = document.getElementById('score-button');
    const resultsEl = document.getElementById('results');
    const scoreEl = document.getElementById('score');
    const progressBar = document.querySelector('.progress');
    const missingKeywordsEl = document.getElementById('missing-keywords');

    scoreButton.addEventListener('click', async () => {
        const jobDesc = jobDescEl.value;
        const resumeFile = resumeUploadEl.files[0];
        const resumeText = resumeTextEl.value;

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
        } else if (resumeText) {
            resumeContent = resumeText;
            sendToServer(jobDesc, resumeContent);
        } else {
            alert('Please upload a resume or paste the text.');
        }
    });

    async function sendToServer(jobDesc, resumeText) {
        resultsEl.classList.remove('visible');
        resultsEl.classList.add('hidden');
        scoreButton.disabled = true;
        scoreButton.innerHTML = '<span class="spinner"></span>Scoring...';

        try {
            const response = await fetch('https://ats-5-lh80.onrender.com/score', {
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
