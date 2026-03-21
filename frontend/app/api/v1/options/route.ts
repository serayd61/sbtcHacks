import { NextRequest, NextResponse } from 'next/server'
import { readOnly } from '@/lib/vault-calls'
import { DEPLOYER_ADDRESS, CONTRACTS } from '@/lib/stacks-config'

// GET /api/v1/options - Get options data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const epochId = searchParams.get('epochId')
    const listingId = searchParams.get('listingId')
    const includeGreeks = searchParams.get('greeks') === 'true'
    const includeStrategies = searchParams.get('strategies') === 'true'
    
    let data: any = {}
    
    // Get specific listing if ID provided
    if (listingId) {
      try {
        const listing = await readOnly(
          CONTRACTS.ADVANCED_OPTIONS_MARKET,
          'get-listing',
          [listingId]
        )
        data.listing = listing
      } catch (error) {
        console.warn('Failed to fetch listing:', error)
      }
    }
    
    // Get epoch data if epoch ID provided
    if (epochId) {
      try {
        const [strikes, statistics, greeks] = await Promise.all([
          readOnly(CONTRACTS.ADVANCED_OPTIONS_MARKET, 'get-epoch-strikes', [epochId]),
          readOnly(CONTRACTS.ADVANCED_OPTIONS_MARKET, 'get-epoch-statistics', [epochId]),
          includeGreeks ? readOnly(CONTRACTS.ADVANCED_OPTIONS_MARKET, 'get-portfolio-greeks', [epochId]) : null
        ])
        
        data.epoch = {
          id: epochId,
          strikes,
          statistics,
          ...(greeks && { greeks })
        }
      } catch (error) {
        console.warn('Failed to fetch epoch data:', error)
      }
    }
    
    // Get market summary
    try {
      const marketSummary = await readOnly(
        CONTRACTS.ADVANCED_OPTIONS_MARKET,
        'get-market-summary',
        []
      )
      data.market = marketSummary
    } catch (error) {
      console.warn('Failed to fetch market summary:', error)
    }
    
    // Get strategies if requested
    if (includeStrategies && epochId) {
      try {
        // This would fetch available strategies for the epoch
        // Implementation depends on strategy contract structure
        data.strategies = [] // Placeholder
      } catch (error) {
        console.warn('Failed to fetch strategies:', error)
      }
    }
    
    const response = {
      success: true,
      data,
      meta: {
        version: '1.0.0',
        network: process.env.NEXT_PUBLIC_NETWORK || 'mainnet',
        timestamp: new Date().toISOString(),
        includeGreeks,
        includeStrategies
      }
    }
    
    return NextResponse.json(response, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        'Access-Control-Allow-Origin': '*',
      }
    })
  } catch (error) {
    console.error('Options API Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to fetch options data',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// POST /api/v1/options - Create option (webhook endpoint)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, action, data } = body
    
    // Validate webhook signature if configured
    const signature = request.headers.get('x-webhook-signature')
    if (process.env.WEBHOOK_SECRET && signature) {
      // Implement signature validation
      const expectedSignature = `sha256=${require('crypto')
        .createHmac('sha256', process.env.WEBHOOK_SECRET)
        .update(JSON.stringify(body))
        .digest('hex')}`
      
      if (signature !== expectedSignature) {
        return NextResponse.json(
          { error: 'Invalid signature', code: 'INVALID_SIGNATURE' },
          { status: 401 }
        )
      }
    }
    
    // Handle different webhook types
    switch (type) {
      case 'option_created':
        // Handle option creation webhook
        console.log('Option created:', data)
        break
        
      case 'option_purchased':
        // Handle option purchase webhook
        console.log('Option purchased:', data)
        break
        
      case 'option_exercised':
        // Handle option exercise webhook
        console.log('Option exercised:', data)
        break
        
      case 'epoch_settled':
        // Handle epoch settlement webhook
        console.log('Epoch settled:', data)
        break
        
      default:
        console.warn('Unknown webhook type:', type)
    }
    
    return NextResponse.json({
      success: true,
      message: 'Webhook processed',
      type,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Webhook processing error:', error)
    
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        code: 'WEBHOOK_ERROR',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}