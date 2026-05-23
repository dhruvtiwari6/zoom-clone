import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.config import get_settings

settings = get_settings()

def send_meeting_minutes(recipient_email: str, meeting_title: str, summary: dict, transcript: str):
    """
    Format meeting minutes into a beautiful, premium dark-mode HTML email template.
    Attempts delivery via SMTP, and ALWAYS saves a copy as a visual HTML report inside
    the local workspace folder for instant previewing.
    """
    # 1. Build a stunning premium styled dark-mode HTML template
    exec_summary = summary.get("executive_summary", "")
    key_topics = summary.get("key_topics", [])
    action_items = summary.get("action_items", [])
    sentiment = summary.get("sentiment", "Positive")

    topics_html = "".join([f"<li style='margin-bottom: 8px; color: #cbd5e1;'>{t}</li>" for t in key_topics])
    
    actions_html = ""
    if action_items:
        actions_html = """
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
                <tr style="background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                    <th style="text-align: left; padding: 10px; color: #94a3b8; font-size: 13px; font-weight: 600;">Action Item</th>
                    <th style="text-align: left; padding: 10px; color: #94a3b8; font-size: 13px; font-weight: 600; width: 120px;">Owner</th>
                </tr>
            </thead>
            <tbody>
        """
        for item in action_items:
            actions_html += f"""
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                    <td style="padding: 10px; color: #e2e8f0; font-size: 13px;">{item.get('item', '')}</td>
                    <td style="padding: 10px; color: #60a5fa; font-size: 13px; font-weight: 600;">{item.get('owner', 'Unassigned')}</td>
                </tr>
            """
        actions_html += "</tbody></table>"
    else:
        actions_html = "<p style='color: #94a3b8; font-style: italic; font-size: 13px;'>No specific action items identified.</p>"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Meeting Minutes: {meeting_title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #111827; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1e3a8a, #0f172a); padding: 32px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); text-align: center;">
                <div style="display: inline-block; padding: 12px; background: rgba(59, 130, 246, 0.15); border-radius: 50%; margin-bottom: 12px; border: 1px solid rgba(59, 130, 246, 0.25);">
                    <span style="font-size: 28px; line-height: 1; vertical-align: middle;">🎙️</span>
                </div>
                <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">AI Meeting Summary</h1>
                <p style="margin: 6px 0 0; color: #94a3b8; font-size: 13px;">Meeting Room: {meeting_title}</p>
            </div>
            
            <!-- Body Content -->
            <div style="padding: 32px;">
                <!-- Executive Summary -->
                <div style="margin-bottom: 28px;">
                    <h3 style="margin: 0 0 10px; color: #3b82f6; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Executive Summary</h3>
                    <p style="margin: 0; color: #f1f5f9; font-size: 14px; line-height: 1.6;">{exec_summary}</p>
                </div>
                
                <hr style="border: 0; border-top: 1px solid rgba(255, 255, 255, 0.05); margin: 24px 0;">

                <!-- Key Topics -->
                <div style="margin-bottom: 28px;">
                    <h3 style="margin: 0 0 10px; color: #3b82f6; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Key Topics Discussed</h3>
                    <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
                        {topics_html}
                    </ul>
                </div>
                
                <hr style="border: 0; border-top: 1px solid rgba(255, 255, 255, 0.05); margin: 24px 0;">

                <!-- Action Items -->
                <div style="margin-bottom: 28px;">
                    <h3 style="margin: 0 0 10px; color: #3b82f6; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Action Items</h3>
                    {actions_html}
                </div>
                
                <hr style="border: 0; border-top: 1px solid rgba(255, 255, 255, 0.05); margin: 24px 0;">

                <!-- Sentiment -->
                <div style="margin-bottom: 28px;">
                    <h3 style="margin: 0 0 8px; color: #3b82f6; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Meeting Tone & Sentiment</h3>
                    <p style="margin: 0; color: #cbd5e1; font-size: 13px; font-style: italic;">{sentiment}</p>
                </div>
                
                <!-- Full Transcript Accordion / Box -->
                <div style="margin-top: 36px; padding: 20px; background: rgba(0, 0, 0, 0.2); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.04);">
                    <h4 style="margin: 0 0 10px; color: #94a3b8; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Full Transcript</h4>
                    <pre style="margin: 0; color: #64748b; font-size: 11px; white-space: pre-wrap; font-family: Consolas, Monaco, monospace; max-height: 150px; overflow-y: auto;">{transcript}</pre>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #0f172a; padding: 20px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                <p style="margin: 0; color: #475569; font-size: 11px;">Zoom AI Note-Taker Companion. Generated automatically upon host termination.</p>
            </div>
        </div>
    </body>
    </html>
    """

    # 2. Local Fallback Visualizer (Always save report copy inside the workspace)
    reports_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../scratch/reports"))
    os.makedirs(reports_dir, exist_ok=True)
    report_filename = f"meeting_{meeting_title.replace(' ', '_')}_minutes.html"
    report_path = os.path.join(reports_dir, report_filename)
    try:
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"[Email Service] Local HTML report copy successfully saved at: {report_path}")
    except Exception as err:
        print(f"[Email Service] Failed to save local HTML report: {err}")

    # 3. SMTP Mail Dispatcher
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print("[Email Service] SMTP credentials not set. Email dispatch bypassed (Local fallback generated!).")
        return

    from_addr = settings.SMTP_FROM or settings.SMTP_USER
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"AI Meeting Summary: {meeting_title}"
    msg["From"] = from_addr
    msg["To"] = recipient_email

    # Plain text version for non-HTML mail clients
    text_content = (
        f"AI Meeting Summary: {meeting_title}\n\n"
        f"Executive Summary:\n{exec_summary}\n\n"
        f"Sentiment:\n{sentiment}\n"
    )

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(from_addr, [recipient_email], msg.as_string())
        server.quit()
        print(f"[Email Service] Meeting minutes successfully emailed to {recipient_email}!")
    except Exception as e:
        print(f"[Email Service] SMTP dispatch error: {e}")
