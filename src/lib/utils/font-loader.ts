/**
 * Font loader utility to dynamically load fonts and set body font-family
 */

export const handleFontsUpdate = (fontUrl: string) => {
    const oldLink = document.getElementById("dynamic-font-link");
    if (oldLink) oldLink.remove();
    const oldStyle = document.getElementById("dynamic-font-style");
    if (oldStyle) oldStyle.remove();
    document.body.style.fontFamily = "";

    if (!fontUrl) return;

    let finalUrl = fontUrl;
    if (!fontUrl.includes("/") && !fontUrl.includes("://")) {
        finalUrl = `/static/fonts/${fontUrl}.css`;
    }

    const fullUrl = finalUrl;
    const pathOnly = finalUrl.split('?')[0].split('#')[0];
    const isCss = pathOnly.toLowerCase().endsWith(".css") || finalUrl.includes("fonts.googleapis.com");
    const isDirectFont = /\.(woff2|woff|ttf|otf)$/i.test(pathOnly);

    if (isCss) {
        const link = document.createElement("link");
        link.id = "dynamic-font-link";
        link.rel = "stylesheet";
        link.href = fullUrl;
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);

        if (fullUrl.includes("fonts.googleapis.com")) {
            const familyMatch = fullUrl.match(/family=([^&:]+)/);
            if (familyMatch) {
                const familyName = decodeURIComponent(familyMatch[1]).replace(/\+/g, ' ');
                document.body.style.fontFamily = `'${familyName}', sans-serif`;
            }
        }
    } else if (isDirectFont) {
        const style = document.createElement("style");
        style.id = "dynamic-font-style";
        const familyName = "DynamicCustomFont";
        style.textContent = `
        @font-face {
          font-family: '${familyName}';
          src: url('${fullUrl}');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        body { font-family: '${familyName}', sans-serif !important; }
      `;
        document.head.appendChild(style);
    }
};
