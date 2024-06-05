const express = require("express");
const puppeteer = require("puppeteer-core");

const app = express();
const PORT = 3033;

app.get("/scrape", async (req, res) => {
	try {
		const { url } = req.query;

		if (!url) {
			return res.status(400).json({ error: "URL parameter is required" });
		}

		// Launch Puppeteer
		// Launch Puppeteer
		const browser = await puppeteer.launch({
			executablePath: "/usr/bin/chromium", // Path to the Chromium binary
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});
		const page = await browser.newPage();

		// Navigate to the desired URL
		await page.goto(url, {
			waitUntil: "networkidle2",
		});

		// Extract data from the page
		const result = await page.evaluate(async () => {
			const getMetaContent = (name) => {
				const element =
					document.querySelector(`meta[name="${name}"]`) ||
					document.querySelector(`meta[property="${name}"]`);
				return element ? element.getAttribute("content") : null;
			};

			const getRelevantImages = async () => {
				const images = Array.from(document.querySelectorAll("img"));

				// Sort images by area (width * height) in descending order
				images.sort((a, b) => {
					return (
						b.naturalWidth * b.naturalHeight -
						a.naturalWidth * a.naturalHeight
					);
				});

				const highQualityImages = [];
				let highestResolutionImage = null;

				for (const img of images) {
					if (img.naturalWidth > 600 && img.naturalHeight > 600) {
						highQualityImages.push(img.src);
					}

					// Track the image with the highest resolution
					if (
						!highestResolutionImage ||
						img.naturalWidth * img.naturalHeight >
							highestResolutionImage.naturalWidth *
								highestResolutionImage.naturalHeight
					) {
						highestResolutionImage = img;
					}
				}

				// Return high-quality images if available, otherwise, return the image with the highest resolution
				return highQualityImages.length > 0
					? highQualityImages
					: [highestResolutionImage.src];
			};

			// Get og:image if it exists
			const ogImage = getMetaContent("og:image");
			const relevantImages = await getRelevantImages();

			// Add og:image to relevant images if it's not already included
			if (ogImage && !relevantImages.includes(ogImage)) {
				relevantImages.push(ogImage);
			}

			const getIconLinks = () => {
				const links = Array.from(
					document.querySelectorAll(
						'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
					)
				);
				return links.map((link) => link.href);
			};

			const getDescription = () => {
				let description = getMetaContent("description");
				if (!description) {
					// If description is null, extract some content from the body of the page
					description = document
						.querySelector("body")
						.textContent.slice(0, 150);
				}
				return description;
			};

			return {
				title: document.title,
				description: getMetaContent("description"),
				keywords:
					getMetaContent("keywords") == null
						? getMetaContent("description")
						: getMetaContent("keywords"),
				ogTitle: getMetaContent("og:title"),
				ogDescription: getDescription(),
				ogImage: ogImage == null ? relevantImages[0] : ogImage,
				ogSiteName:
					getMetaContent("og:site_name") == null
						? document.title
						: getMetaContent("og:site_name"),
				icons: getIconLinks() == null ? ogImage : getIconLinks(),
				images: relevantImages,
			};
		});

		// Close the browser
		await browser.close();

		for (const key in result) {
			if (result[key] === null) {
				return res
					.status(404)
					.json({ error: "metadata is not enough!" });
			}
		}
		// Send the extracted data as a JSON response
		res.json(result);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Something went wrong" });
	}
});

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
