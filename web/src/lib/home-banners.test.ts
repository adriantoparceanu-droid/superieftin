import { test } from 'node:test'
import assert from 'node:assert/strict'
import { homeBannerLayout, clampMainBannerHeight, MAIN_BANNER_MAX_H, MAIN_BANNER_MIN_H } from './home-banners'

test('aranjarea bannerelor după ce e vizibil', () => {
  assert.equal(homeBannerLayout(true, 2), 'grid')
  assert.equal(homeBannerLayout(true, 1), 'grid')
  assert.equal(homeBannerLayout(true, 0), 'main-only')
  assert.equal(homeBannerLayout(false, 2), 'smalls-only')
  assert.equal(homeBannerLayout(false, 1), 'smalls-only')
  assert.equal(homeBannerLayout(false, 0), null)
})

test('înălțimea bannerului mare HTML e limitată', () => {
  assert.equal(clampMainBannerHeight(194.4), 194)
  assert.equal(clampMainBannerHeight(0), MAIN_BANNER_MIN_H)
  assert.equal(clampMainBannerHeight(900), MAIN_BANNER_MAX_H)
})
