import { describe, expect, it } from 'vitest'
import { parseAttachment, serializeAttachment } from '../attachment'

describe('attachment utils', () => {
  describe('serializeAttachment', () => {
    it('should serialize attachment to JSON string', () => {
      const result = serializeAttachment('test.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'base64data')
      expect(result).toBe('{"fileName":"test.docx","mimeType":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","data":"base64data"}')
    })
  })

  describe('parseAttachment', () => {
    it('should parse valid JSON string', () => {
      const json = '{"fileName":"test.docx","mimeType":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","data":"base64data"}'
      const result = parseAttachment(json)
      expect(result).toEqual({
        fileName: 'test.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        data: 'base64data',
      })
    })

    it('should return null for null input', () => {
      expect(parseAttachment(null)).toBeNull()
    })

    it('should return null for undefined input', () => {
      expect(parseAttachment(undefined)).toBeNull()
    })

    it('should return null for invalid JSON', () => {
      expect(parseAttachment('not-json')).toBeNull()
    })

    it('should return null for missing fields', () => {
      expect(parseAttachment('{"fileName":"test.docx"}')).toBeNull()
    })
  })
})
