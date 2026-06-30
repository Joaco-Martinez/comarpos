import type { MetadataRoute } from 'next';

const siteUrl = 'https://www.comarpos.com.ar';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];
}
