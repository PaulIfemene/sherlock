import { describe, expect, it } from 'vitest'
import { cannedWhatsApp, chatIdFor, demoOutbox, maskPhone, parseIncoming, verifyWebhookToken } from '../engine/adapters/greenapi'

const incoming = (messageData: Record<string, unknown>, chatId = '256700000001@c.us', typeWebhook = 'incomingMessageReceived') => ({
  typeWebhook,
  instanceData: { idInstance: 1101000001, wid: '256700000099@c.us', typeInstance: 'whatsapp' },
  timestamp: 1761739200,
  idMessage: 'BAE5F4886F6F2D05',
  senderData: { chatId, sender: chatId, senderName: 'Test' },
  messageData,
})

describe('verifyWebhookToken', () => {
  it('accepts only the exact bearer token', () => {
    expect(verifyWebhookToken('s3cret', 'Bearer s3cret')).toBe(true)
    expect(verifyWebhookToken('s3cret', 'Bearer wrong!')).toBe(false)
    expect(verifyWebhookToken('s3cret', null)).toBe(false)
    expect(verifyWebhookToken('', 'Bearer ')).toBe(false)
  })
})

describe('parseIncoming', () => {
  it('reads plain and extended text messages', () => {
    expect(parseIncoming(incoming({ typeMessage: 'textMessage', textMessageData: { textMessage: 'Monday is a holiday' } }))).toMatchObject({
      from: '256700000001',
      type: 'text',
      text: 'Monday is a holiday',
      timestamp: new Date(1761739200 * 1000),
    })
    expect(parseIncoming(incoming({ typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: 'forwarded with a link' } }))?.text).toBe('forwarded with a link')
  })

  it('reads images with caption and download URL', () => {
    const msg = parseIncoming(incoming({ typeMessage: 'imageMessage', fileMessageData: { downloadUrl: 'https://media.example/x.jpg', caption: 'is this true?', mimeType: 'image/jpeg' } }))
    expect(msg).toMatchObject({ type: 'image', text: 'is this true?', mediaRef: 'https://media.example/x.jpg', mimeType: 'image/jpeg' })
  })

  it('marks unsupported types as other', () => {
    expect(parseIncoming(incoming({ typeMessage: 'audioMessage' }))?.type).toBe('other')
  })

  it('ignores outgoing messages, status callbacks, groups and junk', () => {
    expect(parseIncoming(incoming({ typeMessage: 'textMessage', textMessageData: { textMessage: 'x' } }, '256700000001@c.us', 'outgoingAPIMessageReceived'))).toBeNull()
    expect(parseIncoming({ typeWebhook: 'outgoingMessageStatus', status: 'delivered' })).toBeNull()
    expect(parseIncoming(incoming({ typeMessage: 'textMessage', textMessageData: { textMessage: 'x' } }, '120363000000000000@g.us'))).toBeNull()
    expect(parseIncoming({ nonsense: true })).toBeNull()
  })
})

describe('sending helpers', () => {
  it('builds chat ids from E.164 numbers', () => {
    expect(chatIdFor('+256 700 000 001')).toBe('256700000001@c.us')
  })

  it('masks numbers in the demo outbox and never keeps them whole', async () => {
    expect(maskPhone('+256700000001')).toBe('+256•••••••01')
    await cannedWhatsApp.sendText('+256700000001', 'hello')
    const last = demoOutbox[demoOutbox.length - 1]
    expect(last.body).toBe('hello')
    expect(JSON.stringify(last)).not.toContain('700000001')
  })
})

describe('senderAllowed', () => {
  it('answers everyone when unset, nobody when empty, listed numbers otherwise', async () => {
    const { senderAllowed } = await import('../engine/adapters/greenapi')
    expect(senderAllowed('256700000001', undefined)).toBe(true)
    expect(senderAllowed('256700000001', '')).toBe(false)
    expect(senderAllowed('256700000001', '+256 700 000 001, 256700000002')).toBe(true)
    expect(senderAllowed('256700000003', '256700000001,256700000002')).toBe(false)
  })
})
