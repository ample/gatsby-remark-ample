const lodash = require("lodash")
const path = require("path")

const getOptions = require("./utils/get-options")
const getPermalink = require("./utils/get-permalink")
const processFrontmatter = require("./utils/process-frontmatter")

exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions

  const models = ["Page", "Redirect", "AdminReferences", "AdminSeo"]

  let typeDefs = `
    type MarkdownRemarkFrontmatterSectionsComponents implements Node {
      body: String
    }

    interface ModelFrontmatter {
      id: ID!
      slug: String
      slugPath: String
    }

    type MarkdownRemarkFields implements Node {
      processed_frontmatter: ModelFrontmatter
    }

    type SeoMeta implements Node {
      id: ID!
    }
  `

  for (let model of models) {
    typeDefs += `
      type ${model} implements Node & ModelFrontmatter {
        id: ID!
        seo: SeoMeta
      }
    `
  }

  createTypes(typeDefs)
}

exports.onCreateNode = ({ node, actions, createNodeId, createContentDigest }, options) => {
  // Only process nodes that were created by gatsby-transformer-remark.
  if (lodash.get(node, "internal.type") !== "MarkdownRemark") return

  // Combine options passed into the plugin with the sensible defaults for a
  // comprehensive object of options.
  const args = getOptions(options)

  // Extract the content type so we can set the type of child nodes, which
  // translate to the new frontmatter field, too.
  const model = lodash.get(node, `frontmatter.${args.modelField}`)

  // Set the initial state of the frontmatter to be processed as the slug and
  // slugPath, along with the frontmatter from the MarkdownRemark node.
  const initFrontmatter = {
    // slug is the filename without the extension.
    slug: path.basename(node.fileAbsolutePath, path.extname(node.fileAbsolutePath)),
    // slugPath is the path to the file without the extension and the grouping
    // content directory.
    slugPath: getPermalink({
      absoluteFilePath: node.fileAbsolutePath,
      contentSrc: args.contentSrc
    }),
    // All non-empty properties on the MarkdownRemark node.
    ...lodash.omitBy(node.frontmatter, lodash.isEmpty)
  }

  // Loop through and process each key-value in the frontmatter.
  let { frontmatter, seoData } = processFrontmatter({
    frontmatter: initFrontmatter,
    options: args,
    node: node
  })

  // Initialize a new node as a child of the MarkdownRemark node.
  let newNode = {
    id: createNodeId(`${node.id} - ${model}`),
    children: [],
    parent: node.id,
    internal: {
      contentDigest: createContentDigest(node.internal.content),
      type: model
    },
    // Store the processed frontmatter on the new node.
    ...frontmatter
  }

  // Define outside the conditional so we can use it below for creating a
  // parent-child relationship, if necessary.
  let seoNode = undefined

  // Create the SEO node if SEO there was SEO data in the frontmatter.
  if (seoData) {
    // Process SEO data as though it were frontmatter (to transform images and
    // markdown). In this case, ignore the seoData returned and extract only the
    // processed frontmatter.
    seoData = processFrontmatter({
      frontmatter: seoData,
      options: args,
      node: node
    }).frontmatter
    // Process an SEO node if the new node has SEO data attached to it.
    seoNode = {
      id: createNodeId(`${newNode.id} - SEO`),
      children: [],
      parent: newNode.id,
      internal: {
        contentDigest: createContentDigest(seoData),
        type: `SeoMeta`
      },
      ...seoData
    }
    // Create the SEO node, then set the new node's frontmatter to the new SEO node.
    actions.createNode(seoNode)
    lodash.set(newNode, "seo", seoNode)
  }

  // Create the new node and build a relationship to the parent, so we can use
  // childMarkdownRemark to get to html and other useful attributes.
  actions.createNode(newNode)
  actions.createParentChildLink({ parent: node, child: newNode })

  // Create the parent-child relationship between the new node and the SEO node.
  if (seoNode) actions.createParentChildLink({ parent: node, child: seoNode })

  // Add the transformed frontmatter as a field on the MarkdownRemark node,
  // which will make it available at node.fields.frontmatter.
  actions.createNodeField({
    node,
    name: "processed_frontmatter",
    value: newNode
  })

  // Return the newly created node.
  return newNode
}
