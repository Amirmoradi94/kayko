# Kayko Landing Page - Deployment Guide

This guide will walk you through deploying the Kayko landing page to kayko.site using Netlify.

## Prerequisites

- A Netlify account (free tier works perfectly)
- Domain name: kayko.site (already owned)
- Access to your domain registrar's DNS settings

## Step 1: Create Netlify Account

1. Go to [netlify.com](https://netlify.com)
2. Sign up for a free account (GitHub, Email, or Google)
3. Complete the email verification if required

## Step 2: Deploy the Site

### Option A: Drag & Drop (Quickest)

1. Log into your Netlify dashboard
2. Find the "Sites" section
3. Drag and drop the `landing_page` folder onto the Netlify dashboard
4. Netlify will automatically deploy your site
5. You'll get a temporary URL like `random-name-123.netlify.app`

### Option B: Git Integration (Recommended for Updates)

1. Push your code to GitHub (if not already done)
2. In Netlify dashboard, click "Add new site" → "Import an existing project"
3. Connect to GitHub and select your `kayko` repository
4. Configure build settings:
   - **Base directory**: `landing_page`
   - **Build command**: (leave empty - static site)
   - **Publish directory**: `landing_page`
5. Click "Deploy site"

## Step 3: Connect Custom Domain (kayko.site)

1. In your Netlify site dashboard, go to **Site settings** → **Domain management**
2. Click **Add custom domain**
3. Enter `kayko.site` and click **Verify**
4. Netlify will show you DNS configuration options

## Step 4: Configure DNS Records

You have two options:

### Option 1: Netlify DNS (Easiest - Recommended)

1. In Netlify domain settings, click **Set up Netlify DNS**
2. Netlify will provide you with nameservers (e.g., `dns1.p01.nsone.net`)
3. Go to your domain registrar (where you bought kayko.site)
4. Update nameservers to Netlify's nameservers
5. Wait 24-48 hours for DNS propagation

### Option 2: A Record / CNAME (Keep Current DNS)

1. In Netlify domain settings, choose **Configure DNS**
2. Netlify will show you:
   - **A Record**: Point to `75.2.60.5` (Netlify's IP)
   - **CNAME Record**: Point `www` to `kayko-site.netlify.app`
3. Go to your domain registrar's DNS settings
4. Add the A record for `kayko.site` → `75.2.60.5`
5. Add CNAME record for `www.kayko.site` → `kayko-site.netlify.app`
6. Wait 24-48 hours for DNS propagation

## Step 5: SSL Certificate (Automatic)

1. Once DNS is configured, Netlify automatically provisions an SSL certificate
2. This usually takes 5-10 minutes after DNS propagation
3. Your site will be available at `https://kayko.site` (secure HTTPS)

## Step 6: Verify Deployment

1. Visit `https://kayko.site` in your browser
2. Check that all links work:
   - GitHub link points to correct repo
   - Chrome Web Store link works
   - All navigation links work
3. Test on mobile devices
4. Check that HTTPS is working (green padlock)

## Step 7: Enable Auto-Deployments (If Using Git)

1. In Netlify dashboard → **Site settings** → **Build & deploy**
2. Under **Continuous Deployment**, ensure your Git provider is connected
3. Every push to `main` branch will automatically deploy
4. You can also set up branch previews for pull requests

## Troubleshooting

### DNS Not Working

- **Wait longer**: DNS changes can take up to 48 hours
- **Check DNS propagation**: Use [whatsmydns.net](https://whatsmydns.net) to check
- **Verify records**: Double-check A record or nameservers are correct

### SSL Certificate Issues

- **Wait for DNS**: SSL can't be issued until DNS is fully propagated
- **Check domain verification**: Ensure domain is verified in Netlify
- **Contact support**: Netlify support is helpful if issues persist

### Site Not Loading

- **Check build logs**: In Netlify dashboard → **Deploys** → Click latest deploy
- **Verify file structure**: Ensure `index.html` is in the root of `landing_page`
- **Check redirects**: Verify `_redirects` file is present

## Post-Deployment Checklist

- [ ] Site loads at https://kayko.site
- [ ] HTTPS certificate is active (green padlock)
- [ ] www.kayko.site redirects to kayko.site
- [ ] All navigation links work
- [ ] GitHub link points to correct repository
- [ ] Chrome Web Store link works
- [ ] Mobile responsive design works
- [ ] Page speed is good (check with Google PageSpeed Insights)

## Updating the Site

### If Using Git:
1. Make changes to files in `landing_page/`
2. Commit and push to GitHub
3. Netlify automatically deploys (usually within 1-2 minutes)

### If Using Drag & Drop:
1. Make changes to files locally
2. Drag and drop the `landing_page` folder again
3. Netlify will create a new deployment

## Additional Resources

- [Netlify Documentation](https://docs.netlify.com)
- [Netlify DNS Guide](https://docs.netlify.com/domains-https/custom-domains/configure-external-dns/)
- [Netlify Support](https://www.netlify.com/support/)

## Support

If you encounter issues:
1. Check Netlify's deployment logs
2. Verify DNS settings with your registrar
3. Contact Netlify support (they're very responsive)
4. Check the [Netlify Community Forum](https://answers.netlify.com)

---

**Note**: The first deployment might take a few minutes. Subsequent deployments (with Git) are usually much faster (1-2 minutes).

