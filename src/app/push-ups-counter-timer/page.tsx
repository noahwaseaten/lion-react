'use client'

import { useEffect, useState } from 'react'
import NumberFlow, { NumberFlowGroup } from '@number-flow/react'

function CountUp() {
    const [seconds, setSeconds] = useState(0)
    
    useEffect(() => {
        // Set the start time to 9 AM today
        const now = new Date()
        const start = new Date(now)
        start.setHours(9, 0, 0, 0)
        
        // Calculate initial seconds elapsed
        const initialSeconds = Math.floor((now.getTime() - start.getTime()) / 1000)
        setSeconds(initialSeconds)

        // Update the counter every second
        const timer = setInterval(() => {
            setSeconds(prev => prev + 1)
        }, 1000)

        return () => clearInterval(timer)
    }, [])

    const hh = Math.floor(seconds / 3600)
    const mm = Math.floor((seconds % 3600) / 60)
    const ss = seconds % 60

    return (
        <NumberFlowGroup>
            <div                style={{ fontVariantNumeric: 'tabular-nums', '--number-flow-char-height': '0.85em' } as React.CSSProperties}
                className="text-9xl flex items-baseline font-semibold text-black"
            >
                <NumberFlow trend={1} value={hh} format={{ minimumIntegerDigits: 2 }} />
                <NumberFlow 
                    prefix=":"
                    trend={1}
                    value={mm}
                    digits={{ 1: { max: 5 } }}
                    format={{ minimumIntegerDigits: 2 }}
                />
                <NumberFlow
                    prefix=":"
                    trend={1}
                    value={ss}
                    digits={{ 1: { max: 5 } }}
                    format={{ minimumIntegerDigits: 2 }}
                />
            </div>
        </NumberFlowGroup>
    )
}

export default function Page() {
    return (        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="font-['Arial']">
                <CountUp />
            </div>
        </div>
    )
}