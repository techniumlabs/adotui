class Adotui < Formula
  desc "Terminal UI for managing Azure DevOps pull requests"
  homepage "https://github.com/techniumlabs/adotui"
  version "0.1.7"

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.7/adotui-macos-x64"
      sha256 "4b86c72692cc3477b2da31cc64476ce7e1853a479e91a6a91f8a5ef0440543fd"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.7/adotui-macos-arm64"
      sha256 "157cba23012e9b925377a94cd55902dc6b7ce541839f98336d4dbda5d3f4ab84"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.7/adotui-linux-x64"
      sha256 "f00b6fe1132f2693b5d94fa5d27a97fb552a25515af1600912337f66986bd479"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.7/adotui-linux-arm64"
      sha256 "b31a3b77df03621e4d5716f1b768abe59b68607ffa0798ead91012a4af212b79"
    end
  end

  def install
    if OS.mac? && Hardware::CPU.intel?
      bin.install "adotui-macos-x64" => "adotui"
    elsif OS.mac? && Hardware::CPU.arm?
      bin.install "adotui-macos-arm64" => "adotui"
    elsif OS.linux? && Hardware::CPU.intel?
      bin.install "adotui-linux-x64" => "adotui"
    elsif OS.linux? && Hardware::CPU.arm?
      bin.install "adotui-linux-arm64" => "adotui"
    end
  end
end
