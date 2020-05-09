const deepForEach = require("deep-for-each")
const lodash = require("lodash")
const path = require("path")

const getKeyType = require("./utils/get-key-type")
const getOptions = require("./utils/get-options")
const getPermalink = require("./utils/get-permalink")
const processImage = require("./utils/process-image")
const processMarkdown = require("./utils/process-markdown")

// TODO: Copy relevant frontmatter into top-level key
// TODO: Add slug fields
// TODO: Explicitly set type from schema config
// TODO: Use schema for processing and remove suffix
// TODO: Update options
// TODO: Fix tests
// TODO: Update documentation

exports.createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions

  const models = ["Page", "Redirect", "AdminReferences", "AdminSeo"]

  let typeDefs = `
    type MarkdownRemarkFrontmatterSectionsComponents implements Node {
      body: String
    }

    interface ModelFrontmatter {
      id: ID!
    }

    type MarkdownRemarkFields implements Node {
      frontmatter: ModelFrontmatter
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

  const model = lodash.get(node, `frontmatter.${args.modelField}`)

  // Reference we use to know whether or not to create a child SEO node.
  let seoData

  // Set the initial state of the frontmatter to be processed as the slug and
  // slugPath, along with the frontmatter from the MarkdownRemark node.
  let frontmatter = {
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

  // Loop through each key-value pair in the frontmatter.
  deepForEach(frontmatter, (value, key, subject, keyPath) => {
    // Get type of the node. Most will be "default" and are simply passed
    // through to the new node. Others get processed more specifically to their
    // type.
    const keyType = getKeyType({ keyPath: keyPath, options: args, value: value })
    switch (keyType) {
      // SEO keys simply set the seoData variable and are processed after the
      // new node is created.
      case "seo":
        seoData = value
        break
      // Markdown keys are converted to HTML and stored as a new key without the
      // suffix.
      case "md": {
        const newKeyPath = lodash.trimEnd(keyPath, args.markdownSuffix)
        const newValue = processMarkdown(value)
        if (newValue) lodash.set(frontmatter, newKeyPath, newValue)
        break
      }
      // Image keys are converted to a relative path from the markdown file to
      // the image, and stored as a new key without the suffix.
      case "img": {
        const newKeyPath = lodash.trimEnd(keyPath, args.imageSuffix)
        const newValue = processImage({
          absoluteFilePath: node.fileAbsolutePath,
          imageSrcDir: args.imageSrc,
          value: value
        })
        if (newValue) lodash.set(frontmatter, newKeyPath, newValue)
        break
      }
    }
    // If the key has a type (some keys are ignored), then we pass it through to
    // the new node.
    if (keyType) lodash.set(frontmatter, keyPath, value)
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

  // Process an SEO node if the new node has SEO data attached to it.
  const seoNode = seoData
    ? {
        id: createNodeId(`${newNode.id} - SEO`),
        children: [],
        parent: newNode.id,
        internal: {
          contentDigest: createContentDigest(seoData),
          type: `SeoMeta`
        },
        ...seoData
      }
    : null

  // Create the SEO node, then set the new node's frontmatter to the new SEO node.
  if (seoNode) {
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
    name: "frontmatter",
    value: newNode
  })

  // Return the newly created node.
  return newNode
}
