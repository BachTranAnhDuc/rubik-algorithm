import { Test } from '@nestjs/testing'
import { OAuth2Client } from 'google-auth-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConfigService } from '../../../../infra/config/config.service'
import { InvalidGoogleTokenException } from '../../exceptions'
import { GoogleVerifierService } from '../google-verifier.service'

const verifyIdToken = vi.fn()
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({ verifyIdToken })),
}))

const buildConfigMock = () => ({
  get: vi.fn((key: string) => {
    if (key === 'GOOGLE_CLIENT_ID') return 'client-id'
    return undefined
  }),
})

const compileModule = async () => {
  const config = buildConfigMock()
  const moduleRef = await Test.createTestingModule({
    providers: [GoogleVerifierService, { provide: ConfigService, useValue: config }],
  }).compile()
  return moduleRef.get(GoogleVerifierService)
}

describe('GoogleVerifierService', () => {
  beforeEach(() => {
    verifyIdToken.mockReset()
    ;(OAuth2Client as unknown as ReturnType<typeof vi.fn>).mockClear()
  })

  it('returns sub/email/name/picture from a valid id token', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'g-1',
        email: 'a@b.com',
        name: 'Ana',
        picture: 'https://x/y.png',
      }),
    })
    const service = await compileModule()

    const profile = await service.verify('id-token')

    expect(profile).toEqual({
      sub: 'g-1',
      email: 'a@b.com',
      name: 'Ana',
      picture: 'https://x/y.png',
    })
    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'id-token', audience: 'client-id' })
  })

  it('throws InvalidGoogleTokenException when getPayload returns no sub', async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => ({ email: 'a@b.com' }) })
    const service = await compileModule()

    await expect(service.verify('id-token')).rejects.toBeInstanceOf(InvalidGoogleTokenException)
  })

  it('throws InvalidGoogleTokenException when verifyIdToken rejects', async () => {
    verifyIdToken.mockRejectedValue(new Error('signature mismatch'))
    const service = await compileModule()

    await expect(service.verify('id-token')).rejects.toBeInstanceOf(InvalidGoogleTokenException)
  })
})
