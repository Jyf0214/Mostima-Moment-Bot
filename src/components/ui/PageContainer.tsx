import React from 'react';

interface PageContainerProps {
  maxWidth?: '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
  padding?: 'default' | 'compact' | 'wide';
  children: React.ReactNode;
  className?: string;
}

const maxWidthMap: Record<string, string> = {
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
};

const paddingMap: Record<string, string> = {
  compact: 'px-4 sm:px-6 py-6 sm:py-10',
  default: 'p-6 md:p-10',
  wide: 'px-6 py-12 md:py-20',
};

export function PageContainer({
  maxWidth = '4xl',
  padding = 'default',
  children,
  className = '',
}: PageContainerProps) {
  return (
    <div
      className={`flex-1 ${maxWidthMap[maxWidth]} mx-auto w-full ${paddingMap[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
