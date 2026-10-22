import React from 'react'

export default function SystemHealthCard(){
  // Use downloaded stitch screenshot as placeholder if available
  const imgPath = '/stitch_downloads/042_System_Health_Analytics_screenshot.png'
  return (
    <div className='p-4 bg-white rounded shadow'>
      <div className='mb-4 font-medium'>System Health Analytics (Stitch)</div>
      <div>
        <img src={imgPath} alt='System Health' className='w-full rounded' />
      </div>
    </div>
  )
}
