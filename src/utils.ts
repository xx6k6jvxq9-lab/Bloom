export function extractImageUrls(text: string): string[] {
  if (!text) return [];
  
  const urls: string[] = [];
  const lines = text.split(/[\n,]+/);
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    // Try to extract URL from markdown ![alt](url)
    const markdownMatch = line.match(/!\[.*?\]\((.*?)\)/);
    if (markdownMatch) {
      urls.push(markdownMatch[1]);
      continue;
    }
    
    // Try to extract URL from HTML <img src="url">
    const htmlMatch = line.match(/<img.*?src=["'](.*?)["']/);
    if (htmlMatch) {
      urls.push(htmlMatch[1]);
      continue;
    }
    
    // Try to extract any protocol URL (http, https, ipfs, data, etc)
    const urlMatch = line.match(/((?:https?|ftp|file|ipfs|data):[^\s"']+)/i);
    if (urlMatch) {
      urls.push(urlMatch[1]);
      continue;
    }
    
    // fallback to general URL match
    const generalMatch = line.match(/((?:[a-zA-Z0-9]+:)?\/\/[^\s"']+)/);
    if (generalMatch) {
      urls.push(generalMatch[1]);
      continue;
    }
    
    // If it's just a raw string that looks like a URL but missing protocol
    if (line.startsWith('//')) {
      urls.push('https:' + line);
      continue;
    }
    
    // If it's a base64 string without data: prefix (rare but possible)
    // We'll skip this to avoid false positives
  }
  
  return urls;
}

export function extractSingleImageUrl(text: string): string {
  const urls = extractImageUrls(text);
  return urls.length > 0 ? urls[0] : text.trim();
}
