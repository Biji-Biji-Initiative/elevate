"use server"
import 'server-only'

export async function getKajabiList() {
  const { listKajabiService } = await import('@/lib/server/kajabi-service')
  return listKajabiService()
}

export async function getKajabiHealth() {
  const { kajabiHealthService } = await import('@/lib/server/kajabi-service')
  return kajabiHealthService()
}
