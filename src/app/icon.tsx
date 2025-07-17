import { ImageResponse } from 'next/og'
import { VematizeLogo } from '@/components/icons/logo'

export const runtime = 'edge'
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: '#09090b', // Cor de fundo do seu site
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#007BFF', // Cor azul do seu logo
        }}
      >
        <VematizeLogo className="w-8 h-8" />
      </div>
    ),
    {
      ...size,
    }
  )
} 