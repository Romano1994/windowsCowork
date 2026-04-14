export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

export const TEXT_EXTENSIONS = [
  '.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm', '.css',
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h',
  '.cs', '.rb', '.go', '.rs', '.sh', '.bat', '.ps1', '.yaml', '.yml',
  '.toml', '.ini', '.cfg', '.conf', '.log', '.sql', '.r', '.swift',
];

export const SUPPORTED_EXTENSIONS = [...IMAGE_EXTENSIONS, '.pdf', '.pptx', '.docx', '.xlsx', ...TEXT_EXTENSIONS];

export const MEDIA_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};
