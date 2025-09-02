export async function GET() {
  // Placeholder: return sample earned badges
  const badges = [
    { code: 'LEARN_COMPLETE', name: 'Learn Complete' },
    { code: 'RISING_STAR', name: 'Rising Star' },
  ]
  return new Response(JSON.stringify({ badges }), { headers: { 'content-type': 'application/json' } })
}

