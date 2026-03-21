import { NextRequest, NextResponse } from 'next/server'
import { getVaultInfo, getUserInfo } from '@/lib/vault-calls'
import { DEPLOYER_ADDRESS } from '@/lib/stacks-config'

// Rate limiting
const rateLimitMap = new Map()
const RATE_LIMIT = 100 // requests per minute
const RATE_WINDOW = 60 * 1000 // 1 minute

function rateLimit(ip: string) {
  const now = Date.now()
  const windowStart = now - RATE_WINDOW
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, [])
  }
  
  const requests = rateLimitMap.get(ip).filter((time: number) => time > windowStart)
  requests.push(now)
  rateLimitMap.set(ip, requests)
  
  return requests.length <= RATE_LIMIT
}

function getClientIP(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip')
  return ip || '127.0.0.1'
}

// GET /api/v1/vault - Get vault information
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded', 
        message: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      { status: 429 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const userAddress = searchParams.get('user')
    
    // Get vault info
    const vaultInfo = await getVaultInfo()
    
    // Get user info if address provided
    let userInfo = null
    if (userAddress) {
      try {
        userInfo = await getUserInfo(userAddress)
      } catch (error) {
        console.warn('Failed to fetch user info:', error)
        userInfo = null
      }
    }
    
    const response = {
      success: true,
      data: {
        vault: vaultInfo,
        user: userInfo,
        timestamp: new Date().toISOString(),
        deployer: DEPLOYER_ADDRESS
      },
      meta: {
        version: '1.0.0',
        network: process.env.NEXT_PUBLIC_NETWORK || 'mainnet',
        cacheHit: false
      }
    }
    
    return NextResponse.json(response, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-RateLimit-Remaining': (RATE_LIMIT - (rateLimitMap.get(ip)?.length || 0)).toString(),
        'X-RateLimit-Reset': (Date.now() + RATE_WINDOW).toString()
      }
    })
  } catch (error) {
    console.error('API Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to fetch vault information',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}