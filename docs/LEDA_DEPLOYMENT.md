# pyecod_vis Deployment on Leda

**Server**: leda
**Status**: Running ✅
**Access**: Network-accessible on port 3000

---

## Quick Access

The application is now running on leda and accessible at:

- **http://leda:3000** (from machines that can resolve "leda")
- **http://10.18.0.1:3000** (internal network)
- **http://129.112.32.18:3000** (external IP)
- **http://localhost:3000** (from leda itself)

---

## Server Management

### Start Server (Background)

```bash
cd /home/rschaeff/dev/pyecod_vis
./start_background.sh
```

This will:
- Start the server in the background
- Save the PID to `pyecod_vis.pid`
- Log output to `pyecod_vis.log`
- Continue running even after you log out

### Stop Server

```bash
cd /home/rschaeff/dev/pyecod_vis
./stop_server.sh
```

### View Logs

```bash
cd /home/rschaeff/dev/pyecod_vis
tail -f pyecod_vis.log
```

### Check Status

```bash
cd /home/rschaeff/dev/pyecod_vis
cat pyecod_vis.pid  # Shows PID
ps aux | grep $(cat pyecod_vis.pid)  # Check if running
```

### Start Server (Foreground)

If you want to run the server in foreground (stops when you close terminal):

```bash
cd /home/rschaeff/dev/pyecod_vis
./start_server.sh
```

Press `Ctrl+C` to stop.

---

## Configuration

### Network Binding

The server is configured to bind to `0.0.0.0:3000`, making it accessible from:
- localhost (127.0.0.1)
- Internal network (10.18.0.1)
- External network (129.112.32.18)

This is configured in `package.json`:
```json
{
  "scripts": {
    "dev:leda": "next dev -H 0.0.0.0 -p 3000"
  }
}
```

### Port Configuration

Default port: **3000**

To change the port, edit `package.json`:
```json
"dev:leda": "next dev -H 0.0.0.0 -p YOUR_PORT"
```

Then restart the server.

---

## Database Connection

The application connects to:
- **Host**: dione:45000
- **Database**: ecod_protein
- **Schema**: ecod_curation
- **User**: ecod

Configuration is in `.env.local` - no changes needed as long as dione is accessible from leda.

---

## Files Created

### Management Scripts

- **`start_background.sh`** - Start server in background (persists after logout)
- **`stop_server.sh`** - Stop background server
- **`start_server.sh`** - Start server in foreground (for debugging)

### Runtime Files

- **`pyecod_vis.pid`** - Process ID of running server (auto-generated)
- **`pyecod_vis.log`** - Server output and errors (auto-generated)

These are automatically excluded from git (see `.gitignore`).

---

## Troubleshooting

### Server won't start

```bash
# Check if port 3000 is already in use
lsof -i :3000

# Kill any process using port 3000
kill $(lsof -t -i :3000)

# Try starting again
./start_background.sh
```

### Can't access from network

```bash
# Verify server is bound to 0.0.0.0
netstat -tlnp | grep 3000

# Should show: 0.0.0.0:3000 (not 127.0.0.1:3000)
```

### Server crashes

```bash
# Check logs for errors
tail -50 pyecod_vis.log

# Common issues:
# - Database connection failure (check dione:45000 is accessible)
# - Port already in use
# - npm dependencies not installed (run: npm install)
```

### Syntax errors in code

The server will show compilation errors in the log:

```bash
tail -f pyecod_vis.log
```

Fix the errors and the server will automatically recompile.

---

## Firewall / Network Access

If users outside leda can't access the application:

1. **Check firewall rules** - Port 3000 may be blocked
2. **Test local first** - Can you access from leda itself?
   ```bash
   curl http://localhost:3000
   ```
3. **Test internal network** - Can you access from another machine on 10.18.0.0/16?
   ```bash
   curl http://10.18.0.1:3000
   ```

---

## Production Considerations

### Current Setup (Development Mode)

- Running `next dev` in background
- Hot reload enabled (code changes auto-apply)
- Detailed error messages
- Not optimized for performance

### For Production Deployment

If you want to run in production mode (faster, optimized):

```bash
# Build production bundle
npm run build

# Start production server (background)
nohup npm start > pyecod_vis.log 2>&1 &
echo $! > pyecod_vis.pid
```

Production mode:
- ✓ Optimized bundle (faster)
- ✓ Better performance
- ✗ No hot reload (must rebuild to see changes)
- ✗ Requires root/systemd for automatic restart on boot

**Recommendation**: Stay in dev mode for now since you're actively developing.

---

## Automatic Startup on Reboot

Without root/systemd permissions, the server will NOT automatically start when leda reboots.

After a reboot, manually restart:

```bash
cd /home/rschaeff/dev/pyecod_vis
./start_background.sh
```

**Note**: If you need automatic startup, you'll need to request systemd service setup from admin.

---

## Monitoring

### Check if running

```bash
# Quick check
ps aux | grep "next dev" | grep -v grep

# Or use the PID file
if [ -f pyecod_vis.pid ]; then
  ps -p $(cat pyecod_vis.pid)
fi
```

### Watch logs in real-time

```bash
tail -f pyecod_vis.log
```

### Check resource usage

```bash
ps aux | grep $(cat pyecod_vis.pid)
# Shows CPU% and MEM%
```

---

## Backup and Recovery

### If server crashes

1. Check logs: `tail -50 pyecod_vis.log`
2. Stop any orphaned processes: `./stop_server.sh`
3. Restart: `./start_background.sh`

### If code gets broken

```bash
# Stop server
./stop_server.sh

# Revert changes with git
git checkout src/app/protein/[id]/page.tsx

# Restart
./start_background.sh
```

---

## Development Workflow

### Making Code Changes

1. Edit code in `/home/rschaeff/dev/pyecod_vis/src/`
2. Server automatically recompiles (watch logs)
3. Refresh browser to see changes
4. No need to restart server (unless package.json or .env.local changes)

### Adding npm Packages

```bash
# Install package
npm install package-name

# Restart server to pick up new dependencies
./stop_server.sh
./start_background.sh
```

### Database Schema Changes

If ecod_curation schema changes:
- No server restart needed
- Changes apply immediately
- Update TypeScript types in `src/lib/types.ts` if needed

---

## Summary

✅ **Server is running** on leda:3000
✅ **Network accessible** from 10.18.0.1:3000 and 129.112.32.18:3000
✅ **Database connected** to dione:45000/ecod_protein
✅ **Management scripts** created for easy start/stop
✅ **Logs available** at pyecod_vis.log

## Access URLs

**Internal network**: http://10.18.0.1:3000
**External network**: http://129.112.32.18:3000
**From leda**: http://localhost:3000

Demo the application using any of these URLs!

---

## Next Steps

1. ✅ Server is running - ready for stakeholder demo
2. ⏳ Test from your desktop/laptop (can you access http://10.18.0.1:3000?)
3. ⏳ Share URL with stakeholders
4. ⏳ Gather feedback for Phase 2 features

---

## Support

**Location**: `/home/rschaeff/dev/pyecod_vis`
**Owner**: rschaeff
**Server**: leda (10.18.0.1 / 129.112.32.18)
**Port**: 3000

For issues, check logs first: `tail -f pyecod_vis.log`
