Verify that TTT is deployed and healthy.

## Steps

1. **GitHub Pages deployment:** Check the most recent GH Pages deployment:
   ```
   gh run list --workflow=pages-build-deployment --limit 1
   gh run list --workflow=daily-pipeline.yml --limit 1
   ```
   Report status and when it completed.

2. **Live site:** Fetch the live site and check it returns 200:
   ```
   curl -s -o /dev/null -w "%{http_code}" https://theteslathesis.com
   ```

3. **Stock proxy:** Check the stock proxy health endpoint:
   ```
   curl -s -o /dev/null -w "%{http_code}" https://api.theteslathesis.com/health
   ```

4. **Stock chart:** Check the chart endpoint responds:
   ```
   curl -s -o /dev/null -w "%{http_code}" "https://api.theteslathesis.com/chart?range=1d"
   ```

5. **TypeScript:** Run `npx tsc -b` to check for build errors.

6. Report a health summary:
   - Site: OK/FAIL (status code)
   - Stock proxy: OK/FAIL (status code)
   - Chart API: OK/FAIL (status code)
   - Last deploy: timestamp + status
   - TypeScript: OK/errors
