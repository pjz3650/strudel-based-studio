const { join } = require('node:path');
// rcedit ships Windows executables directly; no macOS symlinks/admin privilege.
exports.default = async (context) => {
  if (context.electronPlatformName !== 'win32') return;
  const module = await import('rcedit');
  const rcedit = module.rcedit ?? module.default;
  await rcedit(join(context.appOutDir, 'Live Studio.exe'), {
    icon: join(context.packager.projectDir, 'assets/icon.ico'),
    'file-version': context.packager.appInfo.version,
    'product-version': context.packager.appInfo.version,
    'version-string': {
      ProductName: 'Live Studio',
      FileDescription: 'Live Studio',
      CompanyName: 'Live Studio contributors',
      LegalCopyright: 'AGPL-3.0-or-later; Strudel contributors',
    },
  });
};
