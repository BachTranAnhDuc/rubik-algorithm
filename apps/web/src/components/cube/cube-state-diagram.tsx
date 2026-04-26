import {
  F2LView,
  OLLView,
  PLLView,
  TopView,
} from '@rubik/visualizer/ssr'
import type { RecognitionBasis } from '@rubik/shared'

interface CubeStateDiagramProps {
  caseState: string
  recognitionBasis: RecognitionBasis
  size?: number
  title?: string
  className?: string
}

export const CubeStateDiagram = ({
  caseState,
  recognitionBasis,
  size,
  title,
  className,
}: CubeStateDiagramProps) => {
  const props = {
    state: caseState,
    ...(size !== undefined ? { size } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(className !== undefined ? { className } : {}),
  }
  switch (recognitionBasis) {
    case 'PLL_PERMUTATION':
      return <PLLView {...props} />
    case 'OLL_ORIENTATION':
      return <OLLView {...props} />
    case 'F2L_SLOT':
      return <F2LView {...props} />
    case 'LAST_LAYER':
    case 'CROSS':
    case 'OTHER':
      return <TopView {...props} />
  }
}
