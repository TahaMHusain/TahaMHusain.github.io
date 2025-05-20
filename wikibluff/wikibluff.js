const articleTitle = "OpenAI"; // Change this as needed
const placeholderImage = "https://via.placeholder.com/100x100?text=No+Image";

async function getFallbackImage(title) {
    const response = await fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=images&format=json&origin=*`);
    const data = await response.json();

    if (!data.parse || !data.parse.images) return null;

    const imageTitles = data.parse.images.filter(name =>
        /\.(jpg|jpeg|png)$/i.test(name)
    );

    for (const imageTitle of imageTitles) {
        const imgInfoRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(imageTitle)}&prop=imageinfo&iiprop=url&format=json&origin=*`);
        const imgInfoData = await imgInfoRes.json();
        const page = Object.values(imgInfoData.query.pages)[0];
        if (page.imageinfo?.[0]?.url) {
            return page.imageinfo[0].url;
        }
    }

    return null;
}

async function loadWikipediaCard(title) {
    const container = document.getElementById("wiki-card-container");

    try {
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
        const data = await res.json();

        let imageUrl = data.thumbnail?.source || await getFallbackImage(title) || placeholderImage;
        const pageUrl = data.content_urls.desktop.page;

        container.innerHTML = `
        <a href="${pageUrl}" target="_blank" rel="noopener noreferrer" class="wiki-link-card">
            <img src="${imageUrl}" alt="${data.title} thumbnail">
            <div class="wiki-content">
            <h2>${data.title}</h2>
            <p>${data.extract}</p>
            </div>
        </a>
        `;
    } catch (error) {
        container.textContent = "Failed to load Wikipedia article.";
        console.error("Error fetching Wikipedia preview:", error);
    }
}

loadWikipediaCard(articleTitle);