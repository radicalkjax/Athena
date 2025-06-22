#!/usr/bin/env python3
from PIL import Image, ImageDraw
import os

# Create icons directory if it doesn't exist
os.makedirs('icons', exist_ok=True)

# Create a simple icon - blue square with rounded corners
def create_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw a rounded rectangle
    padding = size // 8
    radius = size // 10
    
    # Draw rounded rectangle (simplified - just a regular rectangle)
    draw.rounded_rectangle(
        [(padding, padding), (size - padding, size - padding)],
        radius=radius,
        fill=(0, 122, 255, 255),  # Blue color
        outline=(0, 90, 200, 255),
        width=max(1, size // 50)
    )
    
    return img

# Generate PNG icons
sizes = {
    '32x32.png': 32,
    '128x128.png': 128,
    '128x128@2x.png': 256,
    'icon.png': 512
}

for filename, size in sizes.items():
    icon = create_icon(size)
    icon.save(f'icons/{filename}', 'PNG')
    print(f'Created {filename}')

# Generate ICO file for Windows
icon_32 = create_icon(32)
icon_16 = create_icon(16)
icon_48 = create_icon(48)
icon_256 = create_icon(256)

icon_256.save('icons/icon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (256, 256)])
print('Created icon.ico')

# For macOS .icns, we'll use a workaround
# Create a 1024x1024 icon for icns generation
icon_1024 = create_icon(1024)
icon_1024.save('icons/icon_1024.png', 'PNG')

# Use iconutil if available on macOS
import subprocess
import shutil

if shutil.which('iconutil'):
    # Create iconset directory
    iconset_path = 'icons/icon.iconset'
    os.makedirs(iconset_path, exist_ok=True)
    
    # Generate all required sizes for icns
    icns_sizes = [
        (16, 'icon_16x16.png'),
        (32, 'icon_16x16@2x.png'),
        (32, 'icon_32x32.png'),
        (64, 'icon_32x32@2x.png'),
        (128, 'icon_128x128.png'),
        (256, 'icon_128x128@2x.png'),
        (256, 'icon_256x256.png'),
        (512, 'icon_256x256@2x.png'),
        (512, 'icon_512x512.png'),
        (1024, 'icon_512x512@2x.png'),
    ]
    
    for size, filename in icns_sizes:
        icon = create_icon(size)
        icon.save(f'{iconset_path}/{filename}', 'PNG')
    
    # Convert to icns
    try:
        subprocess.run(['iconutil', '-c', 'icns', iconset_path, '-o', 'icons/icon.icns'], check=True)
        print('Created icon.icns')
        # Clean up iconset
        shutil.rmtree(iconset_path)
    except subprocess.CalledProcessError:
        print('Failed to create icns file')
else:
    # Create a placeholder icns file
    with open('icons/icon.icns', 'wb') as f:
        f.write(b'icns')  # Placeholder
    print('Created placeholder icon.icns')

print('All icons generated successfully!')