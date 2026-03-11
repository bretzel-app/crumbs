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

/**
 * Send a welcome email to a newly created user.
 */
export async function sendWelcomeEmail(
	toEmail: string,
	toName: string,
	appUrl: string
): Promise<void> {
	if (!toEmail) return;

	const subject = 'Welcome to Crumbs';
	const html = buildWelcomeEmailHtml(toName, appUrl);
	await sendEmail(toEmail, subject, html);
}

/**
 * Send a password reset notification to a user (triggered by admin reset).
 */
export async function sendPasswordResetEmail(
	toEmail: string,
	toName: string,
	appUrl: string
): Promise<void> {
	if (!toEmail) return;

	const subject = 'Your Crumbs password has been reset';
	const html = buildPasswordResetEmailHtml(toName, appUrl);
	await sendEmail(toEmail, subject, html);
}

/**
 * Send an account deletion confirmation email.
 */
export async function sendAccountDeletedEmail(toEmail: string, toName: string): Promise<void> {
	if (!toEmail) return;

	const subject = 'Your Crumbs account has been deleted';
	const html = buildAccountDeletedEmailHtml(toName);
	await sendEmail(toEmail, subject, html);
}

/**
 * Send a notification to the old email when the account email address changes.
 */
export async function sendEmailChangedEmail(
	oldEmail: string,
	toName: string,
	newEmail: string
): Promise<void> {
	if (!oldEmail) return;

	const subject = 'Your Crumbs email address has been changed';
	const html = buildEmailChangedEmailHtml(toName, newEmail);
	await sendEmail(oldEmail, subject, html);
}

/**
 * Send a role change notification to a user.
 */
export async function sendRoleChangedEmail(
	toEmail: string,
	toName: string,
	newRole: 'admin' | 'user',
	appUrl: string
): Promise<void> {
	if (!toEmail) return;

	const subject = 'Your Crumbs account role has been updated';
	const html = buildRoleChangedEmailHtml(toName, newRole, appUrl);
	await sendEmail(toEmail, subject, html);
}

/**
 * Send a notification to a collaborator that they have been removed from a note.
 */
export async function sendCollaboratorRemovedEmail(
	toEmail: string,
	toName: string,
	ownerName: string,
	noteTitle: string,
	appUrl: string
): Promise<void> {
	if (!toEmail) return;

	const subject = `You've been removed from a shared note`;
	const html = buildCollaboratorRemovedEmailHtml(toName, ownerName, noteTitle, appUrl);
	await sendEmail(toEmail, subject, html);
}

/**
 * Send a notification to collaborators that a shared note has been permanently deleted.
 */
export async function sendNotePermanentlyDeletedEmail(
	toEmail: string,
	toName: string,
	noteTitle: string
): Promise<void> {
	if (!toEmail) return;

	const subject = `A shared note has been deleted`;
	const html = buildNotePermanentlyDeletedEmailHtml(toName, noteTitle);
	await sendEmail(toEmail, subject, html);
}

/**
 * Send a security alert to a user when their account is locked due to too many failed logins.
 */
export async function sendAccountLockedEmail(
	toEmail: string,
	toName: string,
	retryAfterMinutes: number
): Promise<void> {
	if (!toEmail) return;

	const subject = 'Crumbs account temporarily locked';
	const html = buildAccountLockedEmailHtml(toName, retryAfterMinutes);
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
	const content = `<h1 style="margin:0 0 24px;font-size:18px;color:#1a1a2e;font-weight:bold;">Note shared with you</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            Hey ${escapeHtml(displayName)},
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            <strong>${escapedFrom}</strong> shared a note with you: <strong>&ldquo;${escapedTitle}&rdquo;</strong>
          </p>
          ${buildOpenButton(appUrl)}`;
	return buildEmailLayout(content, 'You&rsquo;re receiving this because someone shared a note with you on Crumbs.');
}

function buildEmailLayout(content: string, footer: string): string {
	return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f0e6d3;font-family:'JetBrains Mono',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0e6d3;padding:40px 20px;">
    <tr><td align="center">
      <table width="500" cellpadding="0" cellspacing="0" style="background-color:#faf5eb;border:1px solid #d4cabb;box-shadow:2px 2px 0px #d4cabb;">
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:11px;color:#C8860A;text-transform:uppercase;letter-spacing:2px;">Crumbs</p>
          ${content}
          <p style="margin:0;font-size:11px;color:#6b6272;line-height:1.5;">${footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildOpenButton(appUrl: string, label = 'Open Crumbs'): string {
	return `<table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background-color:#C8860A;box-shadow:2px 2px 0px #1a1a2e;">
              <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:10px 24px;color:#faf5eb;font-size:13px;font-weight:bold;text-decoration:none;font-family:'JetBrains Mono',monospace;">${escapeHtml(label)}</a>
            </td></tr>
          </table>`;
}

function buildWelcomeEmailHtml(toName: string, appUrl: string): string {
	const displayName = escapeHtml(toName || 'there');
	const content = `<h1 style="margin:0 0 24px;font-size:18px;color:#1a1a2e;font-weight:bold;">Welcome to Crumbs</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            Hey ${displayName},
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            An admin has created an account for you on Crumbs. You can log in and start taking notes right away.
          </p>
          ${buildOpenButton(appUrl)}`;
	return buildEmailLayout(content, 'You&rsquo;re receiving this because an admin created an account for you on Crumbs.');
}

function buildPasswordResetEmailHtml(toName: string, appUrl: string): string {
	const displayName = escapeHtml(toName || 'there');
	const content = `<h1 style="margin:0 0 24px;font-size:18px;color:#1a1a2e;font-weight:bold;">Password reset</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            Hey ${displayName},
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            An admin has reset your Crumbs password. Please log in and change it to something only you know.
          </p>
          ${buildOpenButton(appUrl)}`;
	return buildEmailLayout(content, 'You&rsquo;re receiving this because an admin reset your password on Crumbs. If you didn&rsquo;t expect this, please contact your admin.');
}

function buildAccountDeletedEmailHtml(toName: string): string {
	const displayName = escapeHtml(toName || 'there');
	const content = `<h1 style="margin:0 0 24px;font-size:18px;color:#1a1a2e;font-weight:bold;">Account deleted</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            Hey ${displayName},
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            Your Crumbs account and all associated data have been permanently deleted.
          </p>`;
	return buildEmailLayout(content, 'You&rsquo;re receiving this as confirmation that your Crumbs account was deleted.');
}

function buildEmailChangedEmailHtml(toName: string, newEmail: string): string {
	const displayName = escapeHtml(toName || 'there');
	const content = `<h1 style="margin:0 0 24px;font-size:18px;color:#1a1a2e;font-weight:bold;">Email address changed</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            Hey ${displayName},
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            Your Crumbs account email address has been changed to <strong>${escapeHtml(newEmail)}</strong>. If you did not make this change, please contact your admin immediately.
          </p>`;
	return buildEmailLayout(content, 'You&rsquo;re receiving this security notice because your Crumbs account email was updated.');
}

function buildRoleChangedEmailHtml(toName: string, newRole: 'admin' | 'user', appUrl: string): string {
	const displayName = escapeHtml(toName || 'there');
	const roleLabel = newRole === 'admin' ? 'Admin' : 'User';
	const detail = newRole === 'admin'
		? 'You now have admin privileges, including the ability to manage users and settings.'
		: 'Your account no longer has admin privileges.';
	const content = `<h1 style="margin:0 0 24px;font-size:18px;color:#1a1a2e;font-weight:bold;">Role updated: ${roleLabel}</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            Hey ${displayName},
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            Your Crumbs account role has been updated to <strong>${escapeHtml(roleLabel)}</strong>. ${escapeHtml(detail)}
          </p>
          ${buildOpenButton(appUrl)}`;
	return buildEmailLayout(content, 'You&rsquo;re receiving this because your account role was changed on Crumbs.');
}

function buildCollaboratorRemovedEmailHtml(
	toName: string,
	ownerName: string,
	noteTitle: string,
	appUrl: string
): string {
	const displayName = escapeHtml(toName || 'there');
	const escapedOwner = escapeHtml(ownerName || 'Someone');
	const escapedTitle = escapeHtml(noteTitle);
	const content = `<h1 style="margin:0 0 24px;font-size:18px;color:#1a1a2e;font-weight:bold;">Removed from shared note</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            Hey ${displayName},
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            <strong>${escapedOwner}</strong> has removed you from the shared note <strong>&ldquo;${escapedTitle}&rdquo;</strong>. You no longer have access to this note.
          </p>
          ${buildOpenButton(appUrl)}`;
	return buildEmailLayout(content, 'You&rsquo;re receiving this because you were removed from a shared note on Crumbs.');
}

function buildNotePermanentlyDeletedEmailHtml(toName: string, noteTitle: string): string {
	const displayName = escapeHtml(toName || 'there');
	const escapedTitle = escapeHtml(noteTitle);
	const content = `<h1 style="margin:0 0 24px;font-size:18px;color:#1a1a2e;font-weight:bold;">Shared note deleted</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            Hey ${displayName},
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            The shared note <strong>&ldquo;${escapedTitle}&rdquo;</strong> has been permanently deleted by its owner. You no longer have access to it.
          </p>`;
	return buildEmailLayout(content, 'You&rsquo;re receiving this because a shared note you had access to was deleted on Crumbs.');
}

function buildAccountLockedEmailHtml(toName: string, retryAfterMinutes: number): string {
	const displayName = escapeHtml(toName || 'there');
	const content = `<h1 style="margin:0 0 24px;font-size:18px;color:#1a1a2e;font-weight:bold;">Account temporarily locked</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            Hey ${displayName},
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#1a1a2e;line-height:1.6;">
            Too many failed login attempts were made on your Crumbs account. For your security, login has been temporarily blocked for <strong>${retryAfterMinutes} minute${retryAfterMinutes === 1 ? '' : 's'}</strong>. If this wasn&rsquo;t you, please change your password once you regain access.
          </p>`;
	return buildEmailLayout(content, 'You&rsquo;re receiving this security alert because of repeated failed login attempts on your Crumbs account.');
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
