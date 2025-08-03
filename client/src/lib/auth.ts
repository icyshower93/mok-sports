  return fullName.split(' ')[0] || fullName;
}

  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
