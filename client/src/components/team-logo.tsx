interface TeamLogoProps {
  logoUrl: string;
  teamCode: string;
  teamName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6', 
  lg: 'w-8 h-8',
  xl: 'w-12 h-12'
};

const fallbackSizeClasses = {
  sm: 'w-4 h-4 text-xs',
  md: 'w-6 h-6 text-xs',
  lg: 'w-8 h-8 text-xs',
  xl: 'w-12 h-12 text-sm'
};

export function TeamLogo({ logoUrl, teamCode, teamName, size = 'md', className = '' }: TeamLogoProps) {
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // Fallback to team code display
    const fallback = document.createElement('div');
    fallback.className = `${fallbackSizeClasses[size]} bg-secondary rounded-full flex items-center justify-center font-bold flex-shrink-0 ${className}`;
    fallback.textContent = teamCode;
    fallback.title = teamName;
    e.currentTarget.parentNode?.replaceChild(fallback, e.currentTarget);
  };

  return (
    <img 
      src={logoUrl} 
      alt={`${teamName} logo`}
      title={teamName}
      className={`${sizeClasses[size]} rounded-sm object-contain flex-shrink-0 ${className}`}
      onError={handleImageError}
    />
  );
}