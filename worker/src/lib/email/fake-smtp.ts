// Server SMTP minimal, in memorie, DOAR pentru teste (nu trimite nimic mai departe).
// Accepta orice mesaj si il pastreaza in `messages`, ca testele sa verifice ce ar fi plecat.
import { createServer, type Server } from 'node:net'

export interface CapturedMail { from: string; to: string[]; data: string }

export async function startFakeSmtp(port = 0): Promise<{ server: Server; port: number; messages: CapturedMail[]; close: () => Promise<void> }> {
  const messages: CapturedMail[] = []
  const server = createServer((sock) => {
    let buf = ''
    let inData = false
    let cur: CapturedMail = { from: '', to: [], data: '' }
    sock.write('220 fake-smtp ESMTP\r\n')
    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8')
      while (true) {
        if (inData) {
          const end = buf.indexOf('\r\n.\r\n')
          if (end === -1) return
          cur.data = buf.slice(0, end).replace(/\r\n\.\./g, '\r\n.')
          buf = buf.slice(end + 5)
          inData = false
          messages.push(cur)
          cur = { from: '', to: [], data: '' }
          sock.write('250 OK: queued\r\n')
          continue
        }
        const nl = buf.indexOf('\r\n')
        if (nl === -1) return
        const line = buf.slice(0, nl)
        buf = buf.slice(nl + 2)
        const cmd = line.slice(0, 4).toUpperCase()
        if (cmd === 'EHLO' || cmd === 'HELO') sock.write('250-fake-smtp\r\n250-8BITMIME\r\n250 SMTPUTF8\r\n')
        else if (cmd === 'MAIL') { cur.from = line; sock.write('250 OK\r\n') }
        else if (cmd === 'RCPT') { cur.to.push(line); sock.write('250 OK\r\n') }
        else if (cmd === 'DATA') { inData = true; sock.write('354 End data with <CR><LF>.<CR><LF>\r\n') }
        else if (cmd === 'QUIT') { sock.write('221 Bye\r\n'); sock.end() }
        else sock.write('250 OK\r\n')   // RSET, NOOP etc.
      }
    })
    sock.on('error', () => {})
  })
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', () => resolve()))
  const addr = server.address()
  const actualPort = typeof addr === 'object' && addr ? addr.port : port
  return { server, port: actualPort, messages, close: () => new Promise((r) => server.close(() => r())) }
}
