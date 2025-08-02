export function getFirstName(fullName: string): string {
  return fullName.split(' ')[0] || fullName;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
