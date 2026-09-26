// Starea contului Google Ads — DOAR citire (GAQL). Folosita de ads:plan si ads:apply ca sa
// compare YAML-ul cu ce exista deja. ~9 cereri de citire per rulare, indiferent cate campanii.

import { searchAll, type AdsConfig } from '../google-ads.js'

export interface AccCampaign {
  id: string; name: string; status: string; resourceName: string
  channelType: string; biddingStrategyType: string; cpcCeilingMicros: number | null
  network: { googleSearch: boolean; searchNetwork: boolean; contentNetwork: boolean; partnerSearchNetwork: boolean }
  positiveGeoTargetType: string
  budgetResourceName: string; budgetId: string; budgetMicros: number; budgetShared: boolean
}
export interface AccCriterion {
  campaignId: string; criterionId: string; resourceName: string; type: string; negative: boolean
  text?: string; matchType?: string; geo?: string; lang?: string
}
export interface AccAdGroup { id: string; campaignId: string; name: string; status: string; cpcMicros: number; resourceName: string }
export interface AccKeyword { adGroupId: string; criterionId: string; resourceName: string; text: string; matchType: string; status: string; negative: boolean }
export interface AccAd {
  adGroupId: string; adId: string; resourceName: string; adResourceName: string; status: string; type: string
  finalUrls: string[]; headlines: string[]; descriptions: string[]; path1: string; path2: string; approval: string
}
export interface AccAsset { campaignId: string; resourceName: string; fieldType: string; status: string; assetId: string; key: string }
export interface AccCustomGoal { id: string; name: string; resourceName: string; actions: string[]; status: string }
export interface AccGoalConfig { campaignId: string; level: string; customGoal: string }
export interface AccConversionAction { id: string; name: string; status: string; primaryForGoal: boolean }

export interface AccountSnapshot {
  campaigns: AccCampaign[]
  criteria: AccCriterion[]
  adGroups: AccAdGroup[]
  keywords: AccKeyword[]
  ads: AccAd[]
  assets: AccAsset[]
  customGoals: AccCustomGoal[]
  goalConfigs: AccGoalConfig[]
  conversionActions: AccConversionAction[]
}

// Cheia de continut a unei extensii (asa recunoastem ca exista deja, fara ID in YAML)
export const sitelinkKey = (text: string, d1: string | undefined, d2: string | undefined, url: string) =>
  `SITELINK|${text}|${d1 ?? ''}|${d2 ?? ''}|${url}`
export const calloutKey = (text: string) => `CALLOUT|${text}`
export const snippetKey = (header: string, values: string[]) => `STRUCTURED_SNIPPET|${header}|${values.join('|')}`

export function emptySnapshot(): AccountSnapshot {
  return { campaigns: [], criteria: [], adGroups: [], keywords: [], ads: [], assets: [], customGoals: [], goalConfigs: [], conversionActions: [] }
}

const num = (v: unknown) => (v == null ? 0 : Number(v))

export async function readAccount(cfg: AdsConfig): Promise<AccountSnapshot> {
  const [camps, crits, ags, kws, ads, assets, goals, goalCfgs, convs] = await Promise.all([
    searchAll(cfg, `SELECT campaign.id, campaign.name, campaign.status, campaign.resource_name, campaign.advertising_channel_type,
      campaign.bidding_strategy_type, campaign.target_spend.cpc_bid_ceiling_micros,
      campaign.network_settings.target_google_search, campaign.network_settings.target_search_network,
      campaign.network_settings.target_content_network, campaign.network_settings.target_partner_search_network,
      campaign.geo_target_type_setting.positive_geo_target_type, campaign.campaign_budget,
      campaign_budget.id, campaign_budget.amount_micros, campaign_budget.explicitly_shared
      FROM campaign WHERE campaign.status != 'REMOVED'`),
    searchAll(cfg, `SELECT campaign.id, campaign.status, campaign_criterion.status, campaign_criterion.criterion_id, campaign_criterion.resource_name, campaign_criterion.type,
      campaign_criterion.negative, campaign_criterion.keyword.text, campaign_criterion.keyword.match_type,
      campaign_criterion.location.geo_target_constant, campaign_criterion.language.language_constant
      FROM campaign_criterion WHERE campaign.status != 'REMOVED' AND campaign_criterion.status != 'REMOVED'
      AND campaign_criterion.type IN ('KEYWORD', 'LOCATION', 'LANGUAGE')`),
    searchAll(cfg, `SELECT campaign.id, campaign.status, ad_group.id, ad_group.name, ad_group.status, ad_group.cpc_bid_micros, ad_group.resource_name
      FROM ad_group WHERE ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'`),
    searchAll(cfg, `SELECT campaign.status, ad_group.status, ad_group.id, ad_group_criterion.criterion_id, ad_group_criterion.resource_name, ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type, ad_group_criterion.status, ad_group_criterion.negative
      FROM ad_group_criterion WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.status != 'REMOVED'
      AND ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'`),
    searchAll(cfg, `SELECT campaign.status, ad_group.status, ad_group.id, ad_group_ad.resource_name, ad_group_ad.status, ad_group_ad.ad.id, ad_group_ad.ad.resource_name,
      ad_group_ad.ad.type, ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.ad.responsive_search_ad.path1,
      ad_group_ad.ad.responsive_search_ad.path2, ad_group_ad.policy_summary.approval_status
      FROM ad_group_ad WHERE ad_group_ad.status != 'REMOVED' AND ad_group.status != 'REMOVED' AND campaign.status != 'REMOVED'`),
    searchAll(cfg, `SELECT campaign.id, campaign.status, campaign_asset.resource_name, campaign_asset.field_type, campaign_asset.status, asset.id,
      asset.final_urls, asset.sitelink_asset.link_text, asset.sitelink_asset.description1, asset.sitelink_asset.description2,
      asset.callout_asset.callout_text, asset.structured_snippet_asset.header, asset.structured_snippet_asset.values
      FROM campaign_asset WHERE campaign_asset.status != 'REMOVED' AND campaign.status != 'REMOVED'
      AND campaign_asset.field_type IN ('SITELINK', 'CALLOUT', 'STRUCTURED_SNIPPET')`),
    searchAll(cfg, `SELECT custom_conversion_goal.id, custom_conversion_goal.name, custom_conversion_goal.resource_name,
      custom_conversion_goal.conversion_actions, custom_conversion_goal.status FROM custom_conversion_goal`),
    searchAll(cfg, `SELECT campaign.id, campaign.status, conversion_goal_campaign_config.goal_config_level, conversion_goal_campaign_config.custom_conversion_goal
      FROM conversion_goal_campaign_config WHERE campaign.status != 'REMOVED'`),
    searchAll(cfg, `SELECT conversion_action.id, conversion_action.name, conversion_action.status, conversion_action.primary_for_goal
      FROM conversion_action WHERE conversion_action.status != 'REMOVED'`),
  ])

  return {
    campaigns: camps.map((r: any) => ({
      id: String(r.campaign.id), name: r.campaign.name, status: r.campaign.status, resourceName: r.campaign.resourceName,
      channelType: r.campaign.advertisingChannelType, biddingStrategyType: r.campaign.biddingStrategyType,
      cpcCeilingMicros: r.campaign.targetSpend?.cpcBidCeilingMicros != null ? num(r.campaign.targetSpend.cpcBidCeilingMicros) : null,
      network: {
        googleSearch: !!r.campaign.networkSettings?.targetGoogleSearch,
        searchNetwork: !!r.campaign.networkSettings?.targetSearchNetwork,
        contentNetwork: !!r.campaign.networkSettings?.targetContentNetwork,
        partnerSearchNetwork: !!r.campaign.networkSettings?.targetPartnerSearchNetwork,
      },
      positiveGeoTargetType: r.campaign.geoTargetTypeSetting?.positiveGeoTargetType ?? '',
      budgetResourceName: r.campaign.campaignBudget ?? '', budgetId: String(r.campaignBudget?.id ?? ''),
      budgetMicros: num(r.campaignBudget?.amountMicros), budgetShared: !!r.campaignBudget?.explicitlyShared,
    })),
    criteria: crits.map((r: any) => ({
      campaignId: String(r.campaign.id), criterionId: String(r.campaignCriterion.criterionId),
      resourceName: r.campaignCriterion.resourceName, type: r.campaignCriterion.type, negative: !!r.campaignCriterion.negative,
      text: r.campaignCriterion.keyword?.text, matchType: r.campaignCriterion.keyword?.matchType,
      geo: r.campaignCriterion.location?.geoTargetConstant, lang: r.campaignCriterion.language?.languageConstant,
    })),
    adGroups: ags.map((r: any) => ({
      id: String(r.adGroup.id), campaignId: String(r.campaign.id), name: r.adGroup.name, status: r.adGroup.status,
      cpcMicros: num(r.adGroup.cpcBidMicros), resourceName: r.adGroup.resourceName,
    })),
    keywords: kws.map((r: any) => ({
      adGroupId: String(r.adGroup.id), criterionId: String(r.adGroupCriterion.criterionId), resourceName: r.adGroupCriterion.resourceName,
      text: r.adGroupCriterion.keyword?.text ?? '', matchType: r.adGroupCriterion.keyword?.matchType ?? '',
      status: r.adGroupCriterion.status, negative: !!r.adGroupCriterion.negative,
    })),
    ads: ads.map((r: any) => {
      const ad = r.adGroupAd.ad ?? {}
      return {
        adGroupId: String(r.adGroup.id), adId: String(ad.id), resourceName: r.adGroupAd.resourceName, adResourceName: ad.resourceName,
        status: r.adGroupAd.status, type: ad.type, finalUrls: ad.finalUrls ?? [],
        headlines: (ad.responsiveSearchAd?.headlines ?? []).map((h: any) => h.text),
        descriptions: (ad.responsiveSearchAd?.descriptions ?? []).map((d: any) => d.text),
        path1: ad.responsiveSearchAd?.path1 ?? '', path2: ad.responsiveSearchAd?.path2 ?? '',
        approval: r.adGroupAd.policySummary?.approvalStatus ?? '',
      }
    }),
    assets: assets.map((r: any) => {
      const a = r.asset ?? {}
      const ft = r.campaignAsset.fieldType
      const key = ft === 'SITELINK' ? sitelinkKey(a.sitelinkAsset?.linkText ?? '', a.sitelinkAsset?.description1, a.sitelinkAsset?.description2, a.finalUrls?.[0] ?? '')
        : ft === 'CALLOUT' ? calloutKey(a.calloutAsset?.calloutText ?? '')
        : snippetKey(a.structuredSnippetAsset?.header ?? '', a.structuredSnippetAsset?.values ?? [])
      return { campaignId: String(r.campaign.id), resourceName: r.campaignAsset.resourceName, fieldType: ft, status: r.campaignAsset.status, assetId: String(a.id), key }
    }),
    customGoals: goals.map((r: any) => ({
      id: String(r.customConversionGoal.id), name: r.customConversionGoal.name, resourceName: r.customConversionGoal.resourceName,
      actions: r.customConversionGoal.conversionActions ?? [], status: r.customConversionGoal.status,
    })),
    goalConfigs: goalCfgs.map((r: any) => ({
      campaignId: String(r.campaign.id), level: r.conversionGoalCampaignConfig?.goalConfigLevel ?? '',
      customGoal: r.conversionGoalCampaignConfig?.customConversionGoal ?? '',
    })),
    conversionActions: convs.map((r: any) => ({
      id: String(r.conversionAction.id), name: r.conversionAction.name, status: r.conversionAction.status,
      primaryForGoal: !!r.conversionAction.primaryForGoal,
    })),
  }
}
