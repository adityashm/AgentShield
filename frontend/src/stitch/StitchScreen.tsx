import React from 'react'

interface StitchScreenProps {
  src: string
  title?: string
}

export default function StitchScreen({ src, title }: StitchScreenProps) {
  return (
    <iframe
      src={src}
      className="w-full h-[calc(100vh-180px)] border-0 rounded-sm"
      title={title || 'Stitch Wireframe'}
    />
  )
}
