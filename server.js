const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = 3033;

app.get("/scrape", async (req, res) => {
	try {
		const { url } = req.query;

		if (!url) {
			return res.status(400).json({ error: "URL parameter is required" });
		}

		// Launch Puppeteer with the path to the Chromium binary
		// const browser = await puppeteer.launch({
		// 	executablePath:
		// 		process.env.PUPPETEER_EXECUTABLE_PATH ||
		// 		"/usr/bin/chromium-browser", // Path to the Chromium binary
		// 	args: ["--no-sandbox", "--disable-setuid-sandbox"],
		// });
		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		await page.setViewport({ width: 1280, height: 800 }); // Simulate a laptop or desktop screen

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

			const getRelevantImages = () => {
				const images = Array.from(document.querySelectorAll("img"));
				const thresholdWidth = 600;
				const thresholdHeight = 600;

				const highQualityImages = images
					.filter(
						(img) =>
							img.naturalWidth >= thresholdWidth &&
							img.naturalHeight >= thresholdHeight
					)
					.map((img) => decodeURIComponent(img.src))
					.filter((src) => !src.toLowerCase().includes("icon"));

				const sortedImages = images.sort((a, b) => {
					return (
						b.naturalWidth * b.naturalHeight -
						a.naturalWidth * a.naturalHeight
					);
				});

				const highestResolutionImage =
					sortedImages.length > 0 ? sortedImages[0].src : null;

				return highQualityImages.length > 0
					? highQualityImages
					: highestResolutionImage
					? [highestResolutionImage]
					: [];
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

				const iconHrefs = links.map((link) => link.href);

				const logoLinks = Array.from(document.querySelectorAll("a"))
					.filter((a) => a.href.toLowerCase().includes("logo"))
					.map((a) => a.href);

				if (logoLinks.length > 0) {
					return logoLinks[0];
				}

				return iconHrefs.length > 0 ? iconHrefs[0] : null;
			};

			const getDescription = () => {
				const getMetaContent = (name) => {
					const element =
						document.querySelector(`meta[name="${name}"]`) ||
						document.querySelector(`meta[property="${name}"]`);
					return element ? element.getAttribute("content") : null;
				};

				let description =
					getMetaContent("description") ||
					getMetaContent("og:description");

				if (!description) {
					// If description is null, extract meaningful content from the page's body
					const bodyText = document.body.textContent || "";
					const paragraphs = Array.from(
						document.querySelectorAll("p")
					);

					// Find the first non-empty paragraph with a reasonable length
					const meaningfulParagraph = paragraphs.find(
						(p) => p.textContent.trim().length > 150
					);

					// Use the text from the first meaningful paragraph or a slice of the body text
					description = meaningfulParagraph
						? meaningfulParagraph.textContent.trim()
						: bodyText.slice(0, 150).trim();
				}

				return description;
			};

			const getExternalLinks = () => {
				const links = Array.from(document.querySelectorAll("a"));
				const externalLinks = links
					.map((link) => link.href)
					.filter((href) => {
						try {
							const url = new URL(href);
							return url.origin !== document.location.origin;
						} catch (e) {
							return false;
						}
					});
				return [...new Set(externalLinks)];
			};

			return {
				title: document.title,
				description:
					getDescription() == null || getDescription() == ""
						? document.title
						: getDescription(),
				keywords:
					getMetaContent("keywords") == null
						? getMetaContent("description")
						: getMetaContent("keywords"),
				ogTitle:
					getMetaContent("og:title") == null
						? document.title
						: getMetaContent("og:title"),
				thumbnail: ogImage == null ? relevantImages[0] : ogImage,
				ogSiteName:
					getMetaContent("og:site_name") == null
						? document.title
						: getMetaContent("og:site_name"),
				icons: getIconLinks() == null ? ogImage : getIconLinks(),
				images: relevantImages,
				externalLinks: getExternalLinks(),
			};
		});
		const fullUrl = new URL(url).origin; // Construct the full URL (with protocol and hostname)

		const categorizeLinks = (links) => {
			const categories = {
				websites: [],
				socialMedia: [],
				emails: [],
				phoneNumbers: [],
			};

			const socialMediaDomains = [
				"facebook.com",
				"linkedin.com",
				"instagram.com",
				"t.me",
				"twitter.com",
				"youtube.com",
				"tiktok.com",
			];

			links.forEach((link) => {
				const url = new URL(link);

				if (link.startsWith("mailto:")) {
					if (!link.includes("?")) {
						categories.emails.push(link);
					}
				} else if (link.startsWith("tel:")) {
					categories.phoneNumbers.push(link);
				} else if (
					socialMediaDomains.some((domain) =>
						url.hostname.includes(domain)
					)
				) {
					categories.socialMedia.push(link);
				} else if (
					link &&
					link !== "javascript:void(0);" &&
					!url.pathname.match(/\.(jpg|jpeg|png|gif)$/) &&
					!url.hostname.includes("youtu.be")
				) {
					categories.websites.push(link);
				}
			});
			return categories;
		};

		const categorizedLinks = categorizeLinks(result.externalLinks);

		// Close the browser
		await browser.close();

		// Send the extracted data as a JSON response
		res.json({
			fullUrl,
			...result,
			externalLinks: undefined,
			relatedLink: categorizedLinks,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Something went wrong" });
	}
});

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
