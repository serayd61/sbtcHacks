"use client";

import { useEffect, useState } from "react";
import { getEpoch, getVaultInfo } from "@/lib/vault-calls";
import { ONE_SBTC } from "@/lib/stacks-config";
import type { VaultInfo } from "@/lib/types";
import { withRetry } from "@/lib/retry";

interface PerformanceChartProps {
  refreshKey: number;
}

interface DataPoint {
  epoch: number;
  sharePrice: number;
  netReturn: number; // premiumEarned - payout for this epoch
}

export default function PerformanceChart({ refreshKey }: PerformanceChartProps) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const vault: VaultInfo = await withRetry(() => getVaultInfo());
        const currentId = Number(vault.currentEpochId);
        if (currentId === 0) {
          setData([]);
          setLoading(false);
          return;
        }

        const points: DataPoint[] = [{ epoch: 0, sharePrice: 1, netReturn: 0 }];
        let cumulativeReturn = 0;

        for (let i = 1; i <= currentId; i++) {
          try {
            const ep = await withRetry(() => getEpoch(i));
            if (ep && ep.settled) {
              const earned = Number(ep.premiumEarned) / ONE_SBTC;
              const payout = Number(ep.payout) / ONE_SBTC;
              const net = earned - payout;
              cumulativeReturn += net;
              // Share price = 1 + cumulative net return as fraction of initial TVL
              // Simplified: use vault's current share price for latest point
              const price = 1 + cumulativeReturn * 0.1; // Approximate scaling
              points.push({ epoch: i, sharePrice: price, netReturn: net });
            } else {
              // Active/unsettled epoch
              points.push({ epoch: i, sharePrice: points[points.length - 1].sharePrice, netReturn: 0 });
            }
          } catch {
            // skip
          }
        }

        // Override last point with actual share price from vault
        const actualSharePrice = Number(vault.sharePrice) / ONE_SBTC;
        if (points.length > 0) {
          points[points.length - 1].sharePrice = actualSharePrice;
          // Recalculate intermediate prices proportionally if we have actual data
          if (points.length > 2 && actualSharePrice > 1) {
            const factor = (actualSharePrice - 1) / (points[points.length - 1].sharePrice !== 1 ? points[points.length - 1].sharePrice - 1 : 1);
            for (let i = 1; i < points.length - 1; i++) {
              points[i].sharePrice = 1 + (points[i].sharePrice - 1) * (factor || 1);
            }
          }
        }

        setData(points);
      } catch (e) {
        console.error("Failed to load performance data:", e);
      }
      setLoading(false);
    }
    load();
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="h-5 w-40 bg-gray-800 rounded animate-pulse mb-4" />
        <div className="h-40 bg-gray-800 rounded animate-pulse" />
      </div>
    );
  }

  if (data.length <= 1) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Performance</h2>
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">Not enough data for chart</p>
          <p className="text-gray-600 text-xs mt-1">Chart will appear after first epoch settles</p>
        </div>
      </div>
    );
  }

  const currentPrice = data[data.length - 1].sharePrice;
  const totalReturn = ((currentPrice - 1) * 100).toFixed(2);
  const isPositive = currentPrice >= 1;

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Performance</h2>
        <div className="text-right">
          <p className="text-xs text-gray-500">Share Price</p>
          <p className={`text-lg font-bold ${isPositive ? "text-green-400" : "text-red-400"}`}>
            {currentPrice.toFixed(4)} sBTC
          </p>
          <p className={`text-xs font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}>
            {isPositive ? "+" : ""}{totalReturn}%
          </p>
        </div>
      </div>

      <SVGChart data={data} />

      {/* Epoch return bars */}
      {data.length > 1 && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-500 mb-2">Net Return per Epoch (sBTC)</p>
          <div className="flex items-end gap-1 h-16">
            {data.slice(1).map((point) => {
              const maxReturn = Math.max(...data.slice(1).map((d) => Math.abs(d.netReturn)), 0.001);
              const height = Math.max((Math.abs(point.netReturn) / maxReturn) * 100, 5);
              const isPos = point.netReturn >= 0;
              return (
                <div
                  key={point.epoch}
                  className="flex-1 flex flex-col items-center justify-end group relative"
                >
                  <div
                    className={`w-full rounded-t transition-all ${
                      isPos ? "bg-green-500/60 group-hover:bg-green-500" : "bg-red-500/60 group-hover:bg-red-500"
                    }`}
                    style={{ height: `${height}%`, minHeight: "3px" }}
                  />
                  <span className="text-[10px] text-gray-600 mt-1">#{point.epoch}</span>
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 rounded px-2 py-1 text-xs text-white whitespace-nowrap border border-gray-700 z-10">
                    Epoch #{point.epoch}: {isPos ? "+" : ""}{point.netReturn.toFixed(4)} sBTC
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SVGChart({ data }: { data: DataPoint[] }) {
  const width = 600;
  const height = 160;
  const paddingX = 40;
  const paddingY = 20;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const prices = data.map((d) => d.sharePrice);
  const minPrice = Math.min(...prices) * 0.998;
  const maxPrice = Math.max(...prices) * 1.002;
  const priceRange = maxPrice - minPrice || 0.01;

  const getX = (i: number) => paddingX + (i / (data.length - 1)) * chartWidth;
  const getY = (price: number) =>
    paddingY + chartHeight - ((price - minPrice) / priceRange) * chartHeight;

  // Build path
  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(d.sharePrice).toFixed(1)}`)
    .join(" ");

  // Build gradient area
  const areaPath = `${linePath} L ${getX(data.length - 1).toFixed(1)} ${(height - paddingY).toFixed(1)} L ${paddingX.toFixed(1)} ${(height - paddingY).toFixed(1)} Z`;

  const isPositive = data[data.length - 1].sharePrice >= data[0].sharePrice;
  const color = isPositive ? "#22c55e" : "#ef4444";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = paddingY + chartHeight * (1 - frac);
        const price = minPrice + priceRange * frac;
        return (
          <g key={frac}>
            <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#374151" strokeWidth="0.5" strokeDasharray="4" />
            <text x={paddingX - 4} y={y + 3} textAnchor="end" className="fill-gray-600" fontSize="9">
              {price.toFixed(3)}
            </text>
          </g>
        );
      })}

      {/* X axis labels */}
      {data.map((d, i) => {
        if (data.length > 10 && i % 2 !== 0 && i !== data.length - 1) return null;
        return (
          <text key={i} x={getX(i)} y={height - 4} textAnchor="middle" className="fill-gray-600" fontSize="9">
            {d.epoch === 0 ? "Start" : `#${d.epoch}`}
          </text>
        );
      })}

      {/* Area fill */}
      <path d={areaPath} fill="url(#chartGradient)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Data points */}
      {data.map((d, i) => (
        <circle key={i} cx={getX(i)} cy={getY(d.sharePrice)} r="3" fill={color} stroke="#111827" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
