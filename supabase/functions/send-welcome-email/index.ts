import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  firstName: string;
  lastName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName }: WelcomeEmailRequest = await req.json();

    console.log("Sending welcome email to:", email);

    const fullName = `${firstName} ${lastName}`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Agent Connect <noreply@allagentconnect.com>",
        to: [email],
        subject: "Welcome to Agent Connect! 🏡",
        html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
              }
              .container {
                max-width: 600px;
                margin: 40px auto;
                background-color: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 40px 30px;
                text-align: center;
              }
              .header h1 {
                color: #ffffff;
                margin: 0 0 10px 0;
                font-size: 32px;
                font-weight: 600;
              }
              .header p {
                color: rgba(255, 255, 255, 0.9);
                margin: 0;
                font-size: 18px;
              }
              .content {
                padding: 40px 30px;
              }
              .content h2 {
                color: #333;
                font-size: 24px;
                margin-top: 0;
                margin-bottom: 20px;
              }
              .content p {
                color: #666;
                font-size: 16px;
                margin-bottom: 20px;
              }
              .features {
                background-color: #f8f9fa;
                border-radius: 8px;
                padding: 25px;
                margin: 30px 0;
              }
              .feature {
                display: flex;
                align-items: flex-start;
                margin-bottom: 20px;
              }
              .feature:last-child {
                margin-bottom: 0;
              }
              .feature-icon {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                margin-right: 15px;
                flex-shrink: 0;
              }
              .feature-content h3 {
                margin: 0 0 5px 0;
                color: #333;
                font-size: 16px;
                font-weight: 600;
              }
              .feature-content p {
                margin: 0;
                color: #666;
                font-size: 14px;
              }
              .button-container {
                text-align: center;
                margin: 30px 0;
              }
              .button {
                display: inline-block;
                padding: 14px 32px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #ffffff !important;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                font-size: 16px;
                transition: transform 0.2s;
              }
              .button:hover {
                transform: translateY(-2px);
              }
              .footer {
                background-color: #f8f8f8;
                padding: 30px;
                text-align: center;
                color: #999;
                font-size: 14px;
              }
              .footer a {
                color: #667eea;
                text-decoration: none;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to Agent Connect!</h1>
                <p>Your journey to finding the perfect home starts here</p>
              </div>
              
              <div class="content">
                <h2>Hi ${fullName}! 👋</h2>
                <p>Thank you for joining Agent Connect. We're excited to help you navigate the real estate market with complete transparency and ease.</p>
                
                <div class="features">
                  <div class="feature">
                    <div class="feature-icon">🔍</div>
                    <div class="feature-content">
                      <h3>Advanced Search</h3>
                      <p>Filter properties by location, price, size, and more to find exactly what you're looking for.</p>
                    </div>
                  </div>
                  
                  <div class="feature">
                    <div class="feature-icon">❤️</div>
                    <div class="feature-content">
                      <h3>Save Favorites</h3>
                      <p>Bookmark properties you love and get instant alerts on price changes.</p>
                    </div>
                  </div>
                  
                  <div class="feature">
                    <div class="feature-icon">🤝</div>
                    <div class="feature-content">
                      <h3>Connect with Agents</h3>
                      <p>Browse verified agents in your area and connect directly with the right professionals.</p>
                    </div>
                  </div>
                  
                  <div class="feature">
                    <div class="feature-icon">📊</div>
                    <div class="feature-content">
                      <h3>Market Insights</h3>
                      <p>Access real-time data and market trends to make informed decisions.</p>
                    </div>
                  </div>
                </div>
                
                <p>Ready to start exploring?</p>
                
                <div class="button-container">
                  <a href="${Deno.env.get('VITE_SUPABASE_URL')?.replace('https://qocduqtfbsevnhlgsfka.supabase.co', 'https://95492335-3a75-4285-8d44-828003cae42a.lovableproject.com')}/browse" class="button">Browse Properties</a>
                </div>
                
                <p style="margin-top: 30px; font-size: 14px; color: #666;">
                  If you have any questions, our support team is here to help. Just reply to this email or visit our help center.
                </p>
              </div>
              
              <div class="footer">
                <p>
                  <strong>Agent Connect</strong><br>
                  Revolutionizing Real Estate Through Complete Transparency
                </p>
                <p>
                  <a href="mailto:support@agentconnect.com">Contact Support</a> • 
                  <a href="#">Privacy Policy</a> • 
                  <a href="#">Terms of Service</a>
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
      }),
    });

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
