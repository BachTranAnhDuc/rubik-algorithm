import { ImageResponse } from 'next/og'

import { CubeStateDiagram } from '@/components/cube/cube-state-diagram'
import {
  getCaseWithVariants,
  getSetWithCases,
} from '@/features/catalog/catalog-fetchers'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface Props {
  params: Promise<{ method: string; set: string; case: string }>
}

const BACKGROUND = '#0a0a0a'
const FOREGROUND = '#fafafa'
const MUTED = '#a1a1aa'
const DIAGRAM_SIZE = 420

const fallback = () =>
  new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BACKGROUND,
          color: FOREGROUND,
          fontSize: 64,
          fontFamily: 'system-ui',
        }}
      >
        rubik-algorithm
      </div>
    ),
    size,
  )

const OgImage = async ({ params }: Props) => {
  const { set, case: caseSlug } = await params
  let caseData
  let setData
  try {
    ;[caseData, setData] = await Promise.all([
      getCaseWithVariants(caseSlug),
      getSetWithCases(set),
    ])
  } catch {
    return fallback()
  }
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          background: BACKGROUND,
          color: FOREGROUND,
          padding: 60,
          fontFamily: 'system-ui',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 600 }}>
          <div style={{ fontSize: 28, color: MUTED }}>rubik-algorithm</div>
          <div style={{ fontSize: 96, fontWeight: 700, marginTop: 12 }}>
            {caseData.displayName}
          </div>
          <div style={{ fontSize: 32, color: MUTED, marginTop: 8 }}>
            3x3 · cfop · {caseData.slug}
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          <CubeStateDiagram
            caseState={caseData.caseState}
            recognitionBasis={setData.recognitionBasis}
            size={DIAGRAM_SIZE}
          />
        </div>
      </div>
    ),
    size,
  )
}

export default OgImage
