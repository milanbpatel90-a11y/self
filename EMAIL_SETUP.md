Subject: Ticket Assigned - {{ticket_id}}

Dear Support Team,

You have been assigned a new support ticket.

TICKET DETAILS:
─────────────────────────────────────────────
Ticket ID:          {{ticket_id}}
Mobile Number:      {{mobile_number}}
Product:            {{product}}
Priority Level:     {{priority}}
Status:             {{status}}
Assigned Date:      {{assigned_date}}

QUERY DESCRIPTION:
─────────────────────────────────────────────
{{query_description}}

─────────────────────────────────────────────

Please address this ticket at your earliest convenience.

Best regards,
Self-Ticket Support System# Email Configuration Guide

To enable email sending functionality, follow these steps:

## Step 1: Create a Free EmailJS Account

1. Go to https://www.emailjs.com/
2. Sign up for a free account
3. Verify your email

## Step 2: Create an Email Service

1. Go to **Email Services** in your EmailJS dashboard
2. Click **Connect a New Service**
3. Select **Gmail** (or your preferred email provider)
4. Follow the authorization steps
5. Copy your **Service ID** (e.g., `service_xxxxx`)

## Step 3: Create an Email Template

1. Go to **Email Templates** in your EmailJS dashboard
2. Click **Create New Template**
3. Use this template structure:

```
Subject: Ticket Assigned - {{ticket_id}}

Dear Support Team,

You have been assigned a new support ticket.

TICKET DETAILS:
─────────────────────────────────────────────
Ticket ID:          {{ticket_id}}
Mobile Number:      {{mobile_number}}
Product:            {{product}}
Priority Level:     {{priority}}
Status:             {{status}}
Assigned Date:      {{assigned_date}}

QUERY DESCRIPTION:
─────────────────────────────────────────────
{{query_description}}

─────────────────────────────────────────────

Please address this ticket at your earliest convenience.

Best regards,
Self-Ticket Support System
```

4. Copy your **Template ID** (e.g., `template_xxxxx`)

## Step 4: Get Your Public Key

1. Go to **Account** → **API Keys**
2. Copy your **Public Key** (starts with `YOUR_PUBLIC_KEY_HERE`)

## Step 5: Update the Code

Open `app.js` and replace:

```javascript
emailjs.init('YOUR_PUBLIC_KEY_HERE'); // Replace YOUR_PUBLIC_KEY_HERE with your actual public key
emailjs.send('YOUR_SERVICE_ID_HERE', 'YOUR_TEMPLATE_ID_HERE', templateParams)
```

With your actual values:

```javascript
emailjs.init('pk_xxxxxxxxxxxxxxx'); // Your public key
emailjs.send('service_xxxxxxx', 'template_xxxxxxx', templateParams)
```

## Step 6: Test

1. Go to the dashboard
2. Submit a test ticket
3. Click **Claim/Assign**
4. Enter an email address
5. Click **Assign Ticket**
6. Check your email for the ticket details

## Free EmailJS Limits

- Free tier: 200 emails per month
- Perfect for testing and small teams

## Troubleshooting

If emails aren't sent:
1. Check the browser console (F12 → Console tab)
2. Verify your API keys are correct
3. Ensure your email service is properly connected in EmailJS dashboard
4. Check your spam folder

For more help, visit: https://www.emailjs.com/docs/
