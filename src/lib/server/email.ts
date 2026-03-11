import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

/**
 * Check if SMTP email is configured via environment variables.
 */
export function isEmailConfigured(): boolean {
	return !!process.env.SMTP_HOST;
}

/**
 * Get or create the nodemailer transport (lazy singleton).
 */
function getTransporter(): Transporter {
	if (!transporter) {
		transporter = nodemailer.createTransport({
			host: process.env.SMTP_HOST,
			port: parseInt(process.env.SMTP_PORT || '587', 10),
			secure: process.env.SMTP_PORT === '465',
			auth:
				process.env.SMTP_USER
					? {
							user: process.env.SMTP_USER,
							pass: process.env.SMTP_PASS || ''
						}
					: undefined
		});
	}
	return transporter;
}

/**
 * Send an email. Best-effort: logs errors but does not throw.
 */
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
	try {
		const transport = getTransporter();
		await transport.sendMail({
			from: process.env.SMTP_FROM || 'Crumbs <noreply@localhost>',
			to,
			subject,
			html
		});
	} catch (err) {
		console.error('[email] Failed to send:', err);
	}
}

/**
 * Send a share notification email to a collaborator.
 */
export async function sendShareNotification(
	toEmail: string,
	toName: string,
	fromName: string,
	noteTitle: string,
	appUrl: string
): Promise<void> {
	if (!toEmail) return;

	const subject = `${fromName} shared a note with you`;
	const html = buildShareEmailHtml(toName, fromName, noteTitle, appUrl);
	await sendEmail(toEmail, subject, html);
}

function buildShareEmailHtml(
	toName: string,
	fromName: string,
	noteTitle: string,
	appUrl: string
): string {
	const displayName = toName || 'there';
	const escapedTitle = escapeHtml(noteTitle);
	const escapedFrom = escapeHtml(fromName || 'Someone');

	return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f0e6d3;font-family:'JetBrains Mono',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0e6d3;padding:40px 20px;">
    <tr><td align="center">
      <table width="500" cellpadding="0" cellspacing="0" style="background-color:#faf5eb;border:1px solid #d4cabb;box-shadow:2px 2px 0px #d4cabb;">
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:11px;color:#C8860A;text-transform:uppercase;letter-spacing:2px;">Crumbs</p>
          <h1 style="margin:0 0 24px;font-size:18px;color:#1a1a2e;font-weight:bold;">Note shared with you</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            Hey ${escapeHtml(displayName)},
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            <strong>${escapedFrom}</strong> shared a note with you: <strong>&ldquo;${escapedTitle}&rdquo;</strong>
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background-color:#C8860A;box-shadow:2px 2px 0px #1a1a2e;">
              <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:10px 24px;color:#faf5eb;font-size:13px;font-weight:bold;text-decoration:none;font-family:'JetBrains Mono',monospace;">Open Crumbs</a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:11px;color:#6b6272;line-height:1.5;">
            You&rsquo;re receiving this because someone shared a note with you on Crumbs.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
